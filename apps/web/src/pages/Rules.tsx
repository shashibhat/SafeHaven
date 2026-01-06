import React, { useEffect, useState } from 'react';
import { useSystemStore } from '../stores/system';
import { Rule, EventType, ActionType } from '@security-system/shared';
import {
  PlusIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  CogIcon,
  BellIcon,
  VideoCameraIcon,
  LightBulbIcon,
  SpeakerWaveIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';

export const Rules: React.FC = () => {
  const { rules, fetchRules, createRule, updateRule, deleteRule, cameras } = useSystemStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    conditions: [] as any[],
    actions: [] as any[]
  });
  const [conditionForm, setConditionForm] = useState({
    type: 'event_type' as 'event_type' | 'camera' | 'zone' | 'time_range',
    operator: 'equals' as 'equals' | 'contains' | 'greater_than' | 'less_than',
    value: ''
  });
  const [actionForm, setActionForm] = useState({
    type: 'notification' as ActionType,
    config: {}
  });

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingRule) {
      await updateRule(editingRule.id, formData);
    } else {
      await createRule(formData);
    }
    
    setShowAddModal(false);
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      enabled: true,
      conditions: [],
      actions: []
    });
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      conditions: rule.conditions,
      actions: rule.actions
    });
    setShowAddModal(true);
  };

  const handleDelete = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      await deleteRule(ruleId);
    }
  };

  const addCondition = () => {
    if (conditionForm.value) {
      setFormData({
        ...formData,
        conditions: [...formData.conditions, { ...conditionForm }]
      });
      setConditionForm({ type: 'event_type', operator: 'equals', value: '' });
    }
  };

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index)
    });
  };

  const addAction = () => {
    if (actionForm.type) {
      setFormData({
        ...formData,
        actions: [...formData.actions, { ...actionForm }]
      });
      setActionForm({ type: 'notification', config: {} });
    }
  };

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index)
    });
  };

  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case 'notification': return <BellIcon className="h-4 w-4" />;
      case 'record_video': return <VideoCameraIcon className="h-4 w-4" />;
      case 'trigger_siren': return <SpeakerWaveIcon className="h-4 w-4" />;
      case 'turn_on_light': return <LightBulbIcon className="h-4 w-4" />;
      case 'webhook': return <PaperAirplaneIcon className="h-4 w-4" />;
      default: return <CogIcon className="h-4 w-4" />;
    }
  };

  const getConditionDescription = (condition: any) => {
    switch (condition.type) {
      case 'event_type':
        return `Event type ${condition.operator} "${condition.value}"`;
      case 'camera':
        return `Camera ${condition.operator} "${condition.value}"`;
      case 'zone':
        return `Zone ${condition.operator} "${condition.value}"`;
      case 'time_range':
        return `Time ${condition.operator} "${condition.value}"`;
      default:
        return `${condition.type} ${condition.operator} "${condition.value}"`;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Rules</h1>
          <p className="text-gray-600">Create IFTTT-style rules for automated responses</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Add Rule</span>
        </button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {rules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    rule.enabled ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <h3 className="font-medium text-gray-900">{rule.name}</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <CogIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Conditions */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Conditions</h4>
                {rule.conditions.length === 0 ? (
                  <p className="text-sm text-gray-500">No conditions set</p>
                ) : (
                  <div className="space-y-1">
                    {rule.conditions.map((condition, index) => (
                      <div key={index} className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                        {getConditionDescription(condition)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Actions</h4>
                {rule.actions.length === 0 ? (
                  <p className="text-sm text-gray-500">No actions set</p>
                ) : (
                  <div className="space-y-1">
                    {rule.actions.map((action, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                        {getActionIcon(action.type)}
                        <span className="capitalize">{action.type.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last triggered:</span>
                  <span className="text-gray-900">
                    {rule.lastTriggered ? new Date(rule.lastTriggered).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Trigger count:</span>
                  <span className="text-gray-900">{rule.triggerCount}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12">
          <CogIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No rules configured</h3>
          <p className="text-gray-600 mb-4">Create your first rule to automate security responses</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Add Rule
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingRule ? 'Edit Rule' : 'Add Rule'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingRule(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enabled
                    </label>
                    <select
                      value={formData.enabled.toString()}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.value === 'true' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                {/* Conditions */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Conditions</h4>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                          value={conditionForm.type}
                          onChange={(e) => setConditionForm({ ...conditionForm, type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="event_type">Event Type</option>
                          <option value="camera">Camera</option>
                          <option value="zone">Zone</option>
                          <option value="time_range">Time Range</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                        <select
                          value={conditionForm.operator}
                          onChange={(e) => setConditionForm({ ...conditionForm, operator: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="equals">Equals</option>
                          <option value="contains">Contains</option>
                          <option value="greater_than">Greater Than</option>
                          <option value="less_than">Less Than</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                        <input
                          type="text"
                          value={conditionForm.value}
                          onChange={(e) => setConditionForm({ ...conditionForm, value: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addCondition}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                    >
                      Add Condition
                    </button>
                  </div>

                  {formData.conditions.length > 0 && (
                    <div className="space-y-2">
                      {formData.conditions.map((condition, index) => (
                        <div key={index} className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                          <span className="text-sm text-blue-900">
                            {getConditionDescription(condition)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCondition(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Actions</h4>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                      <select
                        value={actionForm.type}
                        onChange={(e) => setActionForm({ ...actionForm, type: e.target.value as ActionType })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="notification">Send Notification</option>
                        <option value="record_video">Record Video</option>
                        <option value="trigger_siren">Trigger Siren</option>
                        <option value="turn_on_light">Turn On Light</option>
                        <option value="webhook">Webhook</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={addAction}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm"
                    >
                      Add Action
                    </button>
                  </div>

                  {formData.actions.length > 0 && (
                    <div className="space-y-2">
                      {formData.actions.map((action, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-2">
                            {getActionIcon(action.type)}
                            <span className="text-sm text-green-900 capitalize">
                              {action.type.replace('_', ' ')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAction(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingRule(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  {editingRule ? 'Update' : 'Add'} Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rules;
