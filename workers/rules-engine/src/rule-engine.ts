import { Database } from './database';
import { 
  Rule, 
  RuleCondition, 
  RuleAction, 
  DetectionEvent, 
  EventType,
  EventSeverity,
  DetectionType 
} from '@security-system/shared/types';
import { MQTTPublisher } from '@security-system/shared/mqtt';
import { format, isAfter, isBefore, addMinutes, addHours } from 'date-fns';

export interface RuleEvaluation {
  rule: Rule;
  triggered: boolean;
  conditionsMet: boolean[];
  lastTriggered?: Date;
  cooldownRemaining?: number;
}

export interface EventContext {
  event: DetectionEvent;
  cameraId: string;
  timestamp: Date;
  recentEvents: DetectionEvent[];
  zoneHistory: Record<string, number>; // zone name -> event count in last hour
}

export class RuleEngine {
  private database: Database;
  private publisher: MQTTPublisher;
  private rules: Map<string, Rule> = new Map();
  private lastTriggered: Map<string, Date> = new Map();
  private recentEvents: Map<string, DetectionEvent[]> = new Map();

  constructor(database: Database, publisher: MQTTPublisher) {
    this.database = database;
    this.publisher = publisher;
  }

  async initialize(): Promise<void> {
    await this.loadRules();
    console.log(`Rule engine initialized with ${this.rules.size} rules`);
  }

  async processEvent(event: DetectionEvent): Promise<void> {
    try {
      const context = await this.buildEventContext(event);
      
      for (const rule of this.rules.values()) {
        if (rule.enabled) {
          const evaluation = await this.evaluateRule(rule, context);
          
          if (evaluation.triggered) {
            await this.triggerRule(rule, evaluation, context);
          }
        }
      }
      
      // Store event in recent history
      this.addToRecentEvents(event);
      
    } catch (error) {
      console.error('Error processing event:', error);
    }
  }

  private async buildEventContext(event: DetectionEvent): Promise<EventContext> {
    const recentEvents = await this.getRecentEvents(event.cameraId, 60); // Last hour
    const zoneHistory = this.calculateZoneHistory(recentEvents);
    
    return {
      event,
      cameraId: event.cameraId,
      timestamp: new Date(event.timestamp),
      recentEvents,
      zoneHistory
    };
  }

  private async evaluateRule(rule: Rule, context: EventContext): Promise<RuleEvaluation> {
    const conditionsMet: boolean[] = [];
    let allConditionsMet = true;
    
    // Check cooldown
    const lastTriggered = this.lastTriggered.get(rule.id);
    if (lastTriggered && rule.cooldownMinutes > 0) {
      const cooldownEnd = addMinutes(lastTriggered, rule.cooldownMinutes);
      if (isAfter(new Date(), cooldownEnd)) {
        const cooldownRemaining = Math.ceil(
          (cooldownEnd.getTime() - new Date().getTime()) / 1000 / 60
        );
        return {
          rule,
          triggered: false,
          conditionsMet: [false],
          lastTriggered,
          cooldownRemaining
        };
      }
    }
    
    // Evaluate each condition
    for (const condition of rule.conditions) {
      const met = await this.evaluateCondition(condition, context);
      conditionsMet.push(met);
      if (!met) {
        allConditionsMet = false;
      }
    }
    
    // Check if all conditions are met (AND logic)
    const triggered = allConditionsMet && conditionsMet.length > 0;
    
    return {
      rule,
      triggered,
      conditionsMet,
      lastTriggered
    };
  }

  private async evaluateCondition(condition: RuleCondition, context: EventContext): Promise<boolean> {
    const { event, recentEvents, zoneHistory } = context;
    
    switch (condition.type) {
      case 'detection':
        return this.evaluateDetectionCondition(condition, event);
      
      case 'zone':
        return this.evaluateZoneCondition(condition, event);
      
      case 'time':
        return this.evaluateTimeCondition(condition, context.timestamp);
      
      case 'frequency':
        return this.evaluateFrequencyCondition(condition, recentEvents);
      
      case 'confidence':
        return this.evaluateConfidenceCondition(condition, event);
      
      case 'severity':
        return this.evaluateSeverityCondition(condition, event);
      
      case 'custom':
        return this.evaluateCustomCondition(condition, event);
      
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  private evaluateDetectionCondition(condition: RuleCondition, event: DetectionEvent): boolean {
    if (!condition.detectionType) return false;
    
    const detectionType = event.detectionType;
    const expectedType = condition.detectionType;
    
    if (condition.operator === 'equals') {
      return detectionType === expectedType;
    } else if (condition.operator === 'not_equals') {
      return detectionType !== expectedType;
    } else if (condition.operator === 'in') {
      return condition.detectionTypes?.includes(detectionType) || false;
    }
    
    return false;
  }

  private evaluateZoneCondition(condition: RuleCondition, event: DetectionEvent): boolean {
    if (!condition.zone) return false;
    
    const zones = event.zones || [];
    const expectedZone = condition.zone;
    
    if (condition.operator === 'in') {
      return zones.includes(expectedZone);
    } else if (condition.operator === 'not_in') {
      return !zones.includes(expectedZone);
    }
    
    return false;
  }

  private evaluateTimeCondition(condition: RuleCondition, timestamp: Date): boolean {
    if (!condition.timeRange) return false;
    
    const currentTime = format(timestamp, 'HH:mm');
    const [startTime, endTime] = condition.timeRange.split('-');
    
    if (condition.timeRange.includes('-')) {
      // Range check
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Exact time check
      return currentTime === condition.timeRange;
    }
  }

  private evaluateFrequencyCondition(condition: RuleCondition, recentEvents: DetectionEvent[]): boolean {
    if (!condition.frequencyThreshold || !condition.frequencyTimeWindow) return false;
    
    const timeWindowMinutes = condition.frequencyTimeWindow;
    const threshold = condition.frequencyThreshold;
    
    const cutoffTime = addMinutes(new Date(), -timeWindowMinutes);
    const relevantEvents = recentEvents.filter(e => 
      new Date(e.timestamp) >= cutoffTime
    );
    
    if (condition.detectionType) {
      // Count specific detection type
      const count = relevantEvents.filter(e => e.detectionType === condition.detectionType).length;
      return count >= threshold;
    } else {
      // Count all events
      return relevantEvents.length >= threshold;
    }
  }

  private evaluateConfidenceCondition(condition: RuleCondition, event: DetectionEvent): boolean {
    if (!condition.confidenceThreshold) return false;
    
    const confidence = event.confidence;
    const threshold = condition.confidenceThreshold;
    
    if (condition.operator === 'greater_than') {
      return confidence > threshold;
    } else if (condition.operator === 'greater_than_or_equal') {
      return confidence >= threshold;
    } else if (condition.operator === 'less_than') {
      return confidence < threshold;
    } else if (condition.operator === 'less_than_or_equal') {
      return confidence <= threshold;
    }
    
    return false;
  }

  private evaluateSeverityCondition(condition: RuleCondition, event: DetectionEvent): boolean {
    if (!condition.severity) return false;
    
    const severity = event.severity;
    const expectedSeverity = condition.severity;
    
    if (condition.operator === 'equals') {
      return severity === expectedSeverity;
    } else if (condition.operator === 'greater_than_or_equal') {
      const severityOrder = { low: 1, medium: 2, high: 3 };
      return severityOrder[severity] >= severityOrder[expectedSeverity];
    }
    
    return false;
  }

  private evaluateCustomCondition(condition: RuleCondition, event: DetectionEvent): boolean {
    if (!condition.customDetection) return false;
    
    const customDetections = event.customDetections || [];
    const expectedCustom = condition.customDetection;
    
    return customDetections.some(cd => cd.label === expectedCustom);
  }

  private async triggerRule(rule: Rule, evaluation: RuleEvaluation, context: EventContext): Promise<void> {
    console.log(`Rule "${rule.name}" triggered for camera ${context.cameraId}`);
    
    // Update last triggered time
    this.lastTriggered.set(rule.id, new Date());
    
    // Execute each action
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, context);
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
      }
    }
    
    // Publish rule triggered event
    await this.publisher.publishRuleTriggered(rule.id, context.cameraId, {
      ruleName: rule.name,
      conditionsMet: evaluation.conditionsMet,
      event: context.event
    });
    
    // Store rule execution in database
    await this.storeRuleExecution(rule.id, context.cameraId, true, evaluation.conditionsMet);
  }

  private async executeAction(action: RuleAction, context: EventContext): Promise<void> {
    const { event, cameraId } = context;
    
    switch (action.type) {
      case 'notification':
        await this.publisher.publishAction('notification', {
          title: action.title || 'Security Alert',
          message: action.message || `Detection: ${event.detectionType}`,
          severity: event.severity,
          cameraId,
          eventId: event.id
        });
        break;
        
      case 'siren':
        await this.publisher.publishAction('siren', {
          duration: action.duration || 30,
          cameraId,
          eventId: event.id
        });
        break;
        
      case 'light':
        await this.publisher.publishAction('light', {
          action: action.lightAction || 'turn_on',
          duration: action.duration,
          cameraId,
          eventId: event.id
        });
        break;
        
      case 'webhook':
        await this.publisher.publishAction('webhook', {
          url: action.url,
          method: action.method || 'POST',
          headers: action.headers || {},
          body: {
            cameraId,
            event: event,
            timestamp: event.timestamp
          },
          eventId: event.id
        });
        break;
        
      case 'record':
        await this.publisher.publishAction('record', {
          duration: action.duration || 60,
          cameraId,
          eventId: event.id
        });
        break;
        
      case 'custom':
        await this.publisher.publishAction('custom', {
          action: action.customAction,
          parameters: action.parameters || {},
          cameraId,
          eventId: event.id
        });
        break;
        
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  private async getRecentEvents(cameraId: string, minutes: number): Promise<DetectionEvent[]> {
    try {
      const rows = await this.database.query(
        `SELECT * FROM detections 
         WHERE camera_id = ? AND timestamp >= datetime('now', '-${minutes} minutes')
         ORDER BY timestamp DESC`,
        [cameraId]
      );
      
      return rows.map(row => ({
        id: row.id,
        cameraId: row.camera_id,
        timestamp: row.timestamp,
        detectionType: row.detection_type,
        confidence: row.confidence,
        bbox: {
          x: row.bbox_x,
          y: row.bbox_y,
          width: row.bbox_width,
          height: row.bbox_height
        },
        zones: JSON.parse(row.zones || '[]'),
        severity: row.severity,
        customDetections: JSON.parse(row.custom_detections || '[]'),
        metadata: JSON.parse(row.metadata || '{}')
      }));
    } catch (error) {
      console.error('Error getting recent events:', error);
      return [];
    }
  }

  private calculateZoneHistory(events: DetectionEvent[]): Record<string, number> {
    const zoneHistory: Record<string, number> = {};
    
    events.forEach(event => {
      event.zones?.forEach(zone => {
        zoneHistory[zone] = (zoneHistory[zone] || 0) + 1;
      });
    });
    
    return zoneHistory;
  }

  private addToRecentEvents(event: DetectionEvent): void {
    const key = event.cameraId;
    if (!this.recentEvents.has(key)) {
      this.recentEvents.set(key, []);
    }
    
    const events = this.recentEvents.get(key)!;
    events.push(event);
    
    // Keep only last 100 events per camera
    if (events.length > 100) {
      events.shift();
    }
  }

  private async loadRules(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM rules WHERE enabled = 1'
      );
      
      this.rules.clear();
      
      for (const row of rows) {
        const rule: Rule = {
          id: row.id,
          name: row.name,
          description: row.description,
          enabled: Boolean(row.enabled),
          conditions: JSON.parse(row.conditions || '[]'),
          actions: JSON.parse(row.actions || '[]'),
          cooldownMinutes: row.cooldown_minutes || 0,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };
        
        this.rules.set(rule.id, rule);
      }
      
      console.log(`Loaded ${this.rules.size} rules`);
    } catch (error) {
      console.error('Error loading rules:', error);
    }
  }

  private async storeRuleExecution(
    ruleId: string,
    cameraId: string,
    triggered: boolean,
    conditionsMet: boolean[]
  ): Promise<void> {
    try {
      await this.database.run(
        `INSERT INTO rule_executions (rule_id, camera_id, triggered, conditions_met, executed_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [ruleId, cameraId, triggered, JSON.stringify(conditionsMet)]
      );
    } catch (error) {
      console.error('Error storing rule execution:', error);
    }
  }

  async reloadRules(): Promise<void> {
    await this.loadRules();
  }

  getRuleStats(): {
    totalRules: number;
    enabledRules: number;
    recentlyTriggered: number;
  } {
    const now = new Date();
    const oneHourAgo = addHours(now, -1);
    
    let recentlyTriggered = 0;
    for (const triggeredTime of this.lastTriggered.values()) {
      if (triggeredTime > oneHourAgo) {
        recentlyTriggered++;
      }
    }
    
    const enabledRules = Array.from(this.rules.values()).filter(r => r.enabled).length;
    
    return {
      totalRules: this.rules.size,
      enabledRules,
      recentlyTriggered
    };
  }
}