import { Database } from './database';
import { MQTTPublisher } from '@security-system/shared/mqtt';
import { EventSeverity } from '@security-system/shared/types';
import * as notifier from 'node-notifier';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

export interface ActionRequest {
  id: string;
  type: string;
  cameraId: string;
  eventId: string;
  parameters: any;
  timestamp: Date;
}

export interface ActionResult {
  success: boolean;
  message: string;
  error?: string;
  executionTime: number;
}

export class ActionExecutor {
  private database: Database;
  private publisher: MQTTPublisher;
  private gpioAvailable: boolean = false;
  private recordingProcesses: Map<string, NodeJS.Timeout> = new Map();

  constructor(database: Database, publisher: MQTTPublisher) {
    this.database = database;
    this.publisher = publisher;
    
    // Check if GPIO is available (on Raspberry Pi/Orange Pi)
    try {
      require('gpio');
      this.gpioAvailable = true;
      console.log('GPIO support available');
    } catch (error) {
      console.log('GPIO not available, using simulation mode');
    }
  }

  async executeAction(request: ActionRequest): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Executing ${request.type} action for camera ${request.cameraId}`);
      
      let result: ActionResult;
      
      switch (request.type) {
        case 'notification':
          result = await this.executeNotification(request);
          break;
          
        case 'siren':
          result = await this.executeSiren(request);
          break;
          
        case 'light':
          result = await this.executeLight(request);
          break;
          
        case 'webhook':
          result = await this.executeWebhook(request);
          break;
          
        case 'record':
          result = await this.executeRecord(request);
          break;
          
        case 'custom':
          result = await this.executeCustom(request);
          break;
          
        default:
          result = {
            success: false,
            message: `Unknown action type: ${request.type}`,
            executionTime: Date.now() - startTime
          };
      }
      
      // Store action execution in database
      await this.storeActionExecution(request, result);
      
      // Publish action result
      await this.publisher.publishActionResult(request.id, result);
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: ActionResult = {
        success: false,
        message: `Action execution failed`,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      };
      
      await this.storeActionExecution(request, result);
      await this.publisher.publishActionResult(request.id, result);
      
      return result;
    }
  }

  private async executeNotification(request: ActionRequest): Promise<ActionResult> {
    try {
      const { title, message, severity } = request.parameters;
      
      // Desktop notification
      notifier.notify({
        title: title || 'Security Alert',
        message: message || 'Security event detected',
        sound: severity === 'high' || severity === 'critical',
        wait: false
      });
      
      // Log to file for audit trail
      const logEntry = {
        timestamp: new Date().toISOString(),
        cameraId: request.cameraId,
        eventId: request.eventId,
        title: title || 'Security Alert',
        message: message || 'Security event detected',
        severity: severity || 'medium'
      };
      
      const logPath = path.join(__dirname, '../../logs/notifications.log');
      await this.ensureDirectoryExists(path.dirname(logPath));
      
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
      
      return {
        success: true,
        message: `Notification sent: ${title}`,
        executionTime: 0
      };
      
    } catch (error) {
      throw new Error(`Notification failed: ${error}`);
    }
  }

  private async executeSiren(request: ActionRequest): Promise<ActionResult> {
    try {
      const { duration = 30 } = request.parameters; // seconds
      
      if (this.gpioAvailable) {
        // Use GPIO to control siren
        const gpio = require('gpio');
        const sirenPin = 17; // Default GPIO pin for siren
        
        const sirenGpio = gpio.export(sirenPin, {
          direction: 'out',
          ready: function() {
            sirenGpio.set(1); // Turn on siren
          }
        });
        
        // Turn off siren after duration
        setTimeout(() => {
          sirenGpio.set(0);
          sirenGpio.unexport();
        }, duration * 1000);
        
      } else {
        // Simulate siren
        console.log(`🚨 SIREN ACTIVATED for ${duration} seconds (Camera: ${request.cameraId})`);
        
        // Simulate turning off after duration
        setTimeout(() => {
          console.log(`🔇 Siren deactivated (Camera: ${request.cameraId})`);
        }, duration * 1000);
      }
      
      return {
        success: true,
        message: `Siren activated for ${duration} seconds`,
        executionTime: 0
      };
      
    } catch (error) {
      throw new Error(`Siren activation failed: ${error}`);
    }
  }

  private async executeLight(request: ActionRequest): Promise<ActionResult> {
    try {
      const { action = 'turn_on', duration } = request.parameters;
      
      if (this.gpioAvailable) {
        // Use GPIO to control lights
        const gpio = require('gpio');
        const lightPin = 18; // Default GPIO pin for lights
        
        const lightGpio = gpio.export(lightPin, {
          direction: 'out',
          ready: function() {
            lightGpio.set(action === 'turn_on' ? 1 : 0);
          }
        });
        
        if (duration && action === 'turn_on') {
          // Turn off after duration
          setTimeout(() => {
            lightGpio.set(0);
            lightGpio.unexport();
          }, duration * 1000);
        }
        
      } else {
        // Simulate light control
        const lightEmoji = action === 'turn_on' ? '💡' : '🔅';
        console.log(`${lightEmoji} Light ${action} (Camera: ${request.cameraId})`);
        
        if (duration && action === 'turn_on') {
          setTimeout(() => {
            console.log(`🔅 Light auto-turned off after ${duration}s (Camera: ${request.cameraId})`);
          }, duration * 1000);
        }
      }
      
      return {
        success: true,
        message: `Light ${action}`,
        executionTime: 0
      };
      
    } catch (error) {
      throw new Error(`Light control failed: ${error}`);
    }
  }

  private async executeWebhook(request: ActionRequest): Promise<ActionResult> {
    try {
      const { url, method = 'POST', headers = {}, body } = request.parameters;
      
      if (!url) {
        throw new Error('Webhook URL is required');
      }
      
      const startTime = Date.now();
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body)
      });
      
      const executionTime = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`);
      }
      
      return {
        success: true,
        message: `Webhook sent successfully (${response.status})`,
        executionTime
      };
      
    } catch (error) {
      throw new Error(`Webhook execution failed: ${error}`);
    }
  }

  private async executeRecord(request: ActionRequest): Promise<ActionResult> {
    try {
      const { duration = 60, cameraId } = request.parameters; // seconds
      
      // Generate recording ID
      const recordingId = `recording-${cameraId}-${Date.now()}`;
      
      // Start recording process (this would integrate with camera system)
      console.log(`📹 Starting recording for camera ${cameraId}, duration: ${duration}s (ID: ${recordingId})`);
      
      // Simulate recording process
      const recordingTimeout = setTimeout(() => {
        console.log(`⏹️ Recording completed for camera ${cameraId} (ID: ${recordingId})`);
        this.recordingProcesses.delete(recordingId);
      }, duration * 1000);
      
      // Store recording process for potential cancellation
      this.recordingProcesses.set(recordingId, recordingTimeout);
      
      // Publish recording started event
      await this.publisher.publishRecordingStarted(recordingId, cameraId, duration);
      
      return {
        success: true,
        message: `Recording started for ${duration} seconds (ID: ${recordingId})`,
        executionTime: 0
      };
      
    } catch (error) {
      throw new Error(`Recording failed: ${error}`);
    }
  }

  private async executeCustom(request: ActionRequest): Promise<ActionResult> {
    try {
      const { action, parameters = {} } = request.parameters;
      
      // Execute custom action based on type
      switch (action) {
        case 'email':
          return await this.executeCustomEmail(parameters);
          
        case 'sms':
          return await this.executeCustomSMS(parameters);
          
        case 'telegram':
          return await this.executeCustomTelegram(parameters);
          
        case 'slack':
          return await this.executeCustomSlack(parameters);
          
        default:
          return {
            success: false,
            message: `Unknown custom action: ${action}`,
            executionTime: 0
          };
      }
      
    } catch (error) {
      throw new Error(`Custom action failed: ${error}`);
    }
  }

  private async executeCustomEmail(parameters: any): Promise<ActionResult> {
    // Placeholder for email sending
    // In production, integrate with email service like SendGrid, AWS SES, etc.
    console.log(`📧 Email notification: ${parameters.subject || 'Security Alert'}`);
    
    return {
      success: true,
      message: 'Email notification queued',
      executionTime: 0
    };
  }

  private async executeCustomSMS(parameters: any): Promise<ActionResult> {
    // Placeholder for SMS sending
    // In production, integrate with SMS service like Twilio, AWS SNS, etc.
    console.log(`📱 SMS notification: ${parameters.message || 'Security Alert'}`);
    
    return {
      success: true,
      message: 'SMS notification queued',
      executionTime: 0
    };
  }

  private async executeCustomTelegram(parameters: any): Promise<ActionResult> {
    // Placeholder for Telegram notification
    // In production, integrate with Telegram Bot API
    console.log(`📲 Telegram notification: ${parameters.message || 'Security Alert'}`);
    
    return {
      success: true,
      message: 'Telegram notification sent',
      executionTime: 0
    };
  }

  private async executeCustomSlack(parameters: any): Promise<ActionResult> {
    // Placeholder for Slack notification
    // In production, integrate with Slack Webhook API
    console.log(`💬 Slack notification: ${parameters.message || 'Security Alert'}`);
    
    return {
      success: true,
      message: 'Slack notification sent',
      executionTime: 0
    };
  }

  private async storeActionExecution(request: ActionRequest, result: ActionResult): Promise<void> {
    try {
      await this.database.run(
        `INSERT INTO action_executions 
         (action_id, action_type, camera_id, event_id, parameters, success, message, error, execution_time, executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          request.id,
          request.type,
          request.cameraId,
          request.eventId,
          JSON.stringify(request.parameters),
          result.success,
          result.message,
          result.error || null,
          result.executionTime
        ]
      );
    } catch (error) {
      console.error('Error storing action execution:', error);
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      require('fs').mkdir(dirPath, { recursive: true }, (err: any) => {
        if (err && err.code !== 'EEXIST') {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  stopRecording(recordingId: string): boolean {
    const timeout = this.recordingProcesses.get(recordingId);
    if (timeout) {
      clearTimeout(timeout);
      this.recordingProcesses.delete(recordingId);
      console.log(`⏹️ Recording stopped: ${recordingId}`);
      return true;
    }
    return false;
  }

  getRecordingProcesses(): string[] {
    return Array.from(this.recordingProcesses.keys());
  }
}