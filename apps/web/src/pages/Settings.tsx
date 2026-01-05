import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { useSystemStore } from '../stores/system';
import {
  CogIcon,
  UserIcon,
  ShieldIcon,
  BellIcon,
  VideoCameraIcon,
  CpuChipIcon,
  CloudIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

export const Settings: React.FC = () => {
  const { user, updatePassword } = useAuthStore();
  const { systemStatus, fetchSystemStatus, updateSystemSettings } = useSystemStore();
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'notifications' | 'cameras' | 'ai' | 'storage'>('general');
  const [settings, setSettings] = useState({
    systemName: 'Security System',
    timezone: 'UTC',
    language: 'en',
    theme: 'light'
  });
  const [securitySettings, setSecuritySettings] = useState({
    passwordMinLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    sessionTimeout: 3600,
    maxLoginAttempts: 5
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    smsNotifications: false,
    quietHours: { start: '22:00', end: '07:00' },
    severityFilter: ['high', 'medium']
  });
  const [cameraSettings, setCameraSettings] = useState({
    defaultRecordingDuration: 300,
    motionSensitivity: 0.7,
    personDetectionSensitivity: 0.8,
    faceRecognitionSensitivity: 0.6,
    packageDetectionSensitivity: 0.7,
    maxSimultaneousStreams: 4
  });
  const [aiSettings, setAiSettings] = useState({
    inferenceDevice: 'cpu' as 'cpu' | 'gpu' | 'npu',
    modelCacheSize: 100,
    batchSize: 1,
    confidenceThreshold: 0.5,
    enableCustomModels: true,
    enableFaceRecognition: true,
    enablePackageDetection: true
  });
  const [storageSettings, setStorageSettings] = useState({
    maxStorageGB: 100,
    retentionDays: 30,
    autoDeleteOldFiles: true,
    compressionEnabled: true,
    backupEnabled: false
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSystemStatus();
    // Load settings from API
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.general || settings);
        setSecuritySettings(data.security || securitySettings);
        setNotificationSettings(data.notifications || notificationSettings);
        setCameraSettings(data.cameras || cameraSettings);
        setAiSettings(data.ai || aiSettings);
        setStorageSettings(data.storage || storageSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (section: string, data: any) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/settings/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings.');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match.');
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    
    try {
      await updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
      alert('Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      alert('Failed to update password.');
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: CogIcon },
    { id: 'security', label: 'Security', icon: ShieldIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'cameras', label: 'Cameras', icon: VideoCameraIcon },
    { id: 'ai', label: 'AI & Detection', icon: CpuChipIcon },
    { id: 'storage', label: 'Storage', icon: CloudIcon }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your security system preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'general' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-medium text-gray-900">General Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System Name
                </label>
                <input
                  type="text"
                  value={settings.systemName}
                  onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Theme
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => saveSettings('general', settings)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md"
            >
              {saving ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
            
            {/* Password Change */}
            <div className="border-b border-gray-200 pb-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Change Password</h4>
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? <EyeSlashIcon className="h-4 w-4 text-gray-400" /> : <EyeIcon className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                >
                  Change Password
                </button>
              </form>
            </div>

            {/* Password Policy */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Password Policy</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Length
                  </label>
                  <input
                    type="number"
                    value={securitySettings.passwordMinLength}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, passwordMinLength: parseInt(e.target.value) })}
                    min="4"
                    max="32"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    value={securitySettings.sessionTimeout}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) })}
                    min="300"
                    max="86400"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    value={securitySettings.maxLoginAttempts}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: parseInt(e.target.value) })}
                    min="3"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={securitySettings.requireUppercase}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, requireUppercase: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require uppercase letters</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={securitySettings.requireNumbers}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, requireNumbers: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require numbers</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={securitySettings.requireSpecialChars}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, requireSpecialChars: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require special characters</span>
                </label>
              </div>

              <button
                onClick={() => saveSettings('security', securitySettings)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md"
              >
                {saving ? 'Saving...' : 'Save Security Settings'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Notification Settings</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable email notifications</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationSettings.pushNotifications}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, pushNotifications: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable push notifications</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationSettings.smsNotifications}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, smsNotifications: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable SMS notifications</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quiet Hours Start
                  </label>
                  <input
                    type="time"
                    value={notificationSettings.quietHours.start}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      quietHours: { ...notificationSettings.quietHours, start: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quiet Hours End
                  </label>
                  <input
                    type="time"
                    value={notificationSettings.quietHours.end}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      quietHours: { ...notificationSettings.quietHours, end: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Severity Filter
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings.severityFilter.includes('high')}
                      onChange={(e) => {
                        const newFilter = e.target.checked
                          ? [...notificationSettings.severityFilter, 'high']
                          : notificationSettings.severityFilter.filter(s => s !== 'high');
                        setNotificationSettings({ ...notificationSettings, severityFilter: newFilter });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">High severity events</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings.severityFilter.includes('medium')}
                      onChange={(e) => {
                        const newFilter = e.target.checked
                          ? [...notificationSettings.severityFilter, 'medium']
                          : notificationSettings.severityFilter.filter(s => s !== 'medium');
                        setNotificationSettings({ ...notificationSettings, severityFilter: newFilter });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Medium severity events</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings.severityFilter.includes('low')}
                      onChange={(e) => {
                        const newFilter = e.target.checked
                          ? [...notificationSettings.severityFilter, 'low']
                          : notificationSettings.severityFilter.filter(s => s !== 'low');
                        setNotificationSettings({ ...notificationSettings, severityFilter: newFilter });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Low severity events</span>
                  </label>
                </div>
              </div>

              <button
                onClick={() => saveSettings('notifications', notificationSettings)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md"
              >
                {saving ? 'Saving...' : 'Save Notification Settings'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'cameras' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Camera Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Recording Duration (seconds)
                </label>
                <input
                  type="number"
                  value={cameraSettings.defaultRecordingDuration}
                  onChange={(e) => setCameraSettings({ ...cameraSettings, defaultRecordingDuration: parseInt(e.target.value) })}
                  min="30"
                  max="3600"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Simultaneous Streams
                </label>
                <input
                  type="number"
                  value={cameraSettings.maxSimultaneousStreams}
                  onChange={(e) => setCameraSettings({ ...cameraSettings, maxSimultaneousStreams: parseInt(e.target.value) })}
                  min="1"
                  max="16"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motion Detection Sensitivity
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={cameraSettings.motionSensitivity}
                  onChange={(e) => setCameraSettings({ ...cameraSettings, motionSensitivity: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>{(cameraSettings.motionSensitivity * 100).toFixed(0)}%</span>
                  <span>High</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Person Detection Sensitivity
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={cameraSettings.personDetectionSensitivity}
                  onChange={(e) => setCameraSettings({ ...cameraSettings, personDetectionSensitivity: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>{(cameraSettings.personDetectionSensitivity * 100).toFixed(0)}%</span>
                  <span>High</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Face Recognition Sensitivity
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={cameraSettings.faceRecognitionSensitivity}
                  onChange={(e) => setCameraSettings({ ...cameraSettings, faceRecognitionSensitivity: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>{(cameraSettings.faceRecognitionSensitivity * 100).toFixed(0)}%</span>
                  <span>High</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Package Detection Sensitivity
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={cameraSettings.packageDetectionSensitivity}
                  onChange={(e) => setCameraSettings({ ...cameraSettings, packageDetectionSensitivity: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>{(cameraSettings.packageDetectionSensitivity * 100).toFixed(0)}%</span>
                  <span>High</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => saveSettings('cameras', cameraSettings)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md"
            >
              {saving ? 'Saving...' : 'Save Camera Settings'}
            </button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-medium text-gray-900">AI & Detection Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inference Device
                </label>
                <select
                  value={aiSettings.inferenceDevice}
                  onChange={(e) => setAiSettings({ ...aiSettings, inferenceDevice: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cpu">CPU</option>
                  <option value="gpu">GPU</option>
                  <option value="npu">NPU (Neural Processing Unit)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model Cache Size (MB)
                </label>
                <input
                  type="number"
                  value={aiSettings.modelCacheSize}
                  onChange={(e) => setAiSettings({ ...aiSettings, modelCacheSize: parseInt(e.target.value) })}
                  min="10"
                  max="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch Size
                </label>
                <input
                  type="number"
                  value={aiSettings.batchSize}
                  onChange={(e) => setAiSettings({ ...aiSettings, batchSize: parseInt(e.target.value) })}
                  min="1"
                  max="32"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confidence Threshold
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={aiSettings.confidenceThreshold}
                  onChange={(e) => setAiSettings({ ...aiSettings, confidenceThreshold: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>{(aiSettings.confidenceThreshold * 100).toFixed(0)}%</span>
                  <span>High</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={aiSettings.enableCustomModels}
                  onChange={(e) => setAiSettings({ ...aiSettings, enableCustomModels: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Enable custom AI models</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={aiSettings.enableFaceRecognition}
                  onChange={(e) => setAiSettings({ ...aiSettings, enableFaceRecognition: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Enable face recognition</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={aiSettings.enablePackageDetection}
                  onChange={(e) => setAiSettings({ ...aiSettings, enablePackageDetection: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Enable package detection</span>
              </label>
            </div>

            <button
              onClick={() => saveSettings('ai', aiSettings)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md"
            >
              {saving ? 'Saving...' : 'Save AI Settings'}
            </button>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Storage Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Storage (GB)
                </label>
                <input
                  type="number"
                  value={storageSettings.maxStorageGB}
                  onChange={(e) => setStorageSettings({ ...storageSettings, maxStorageGB: parseInt(e.target.value) })}
                  min="1"
                  max="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retention Days
                </label>
                <input
                  type="number"
                  value={storageSettings.retentionDays}
                  onChange={(e) => setStorageSettings({ ...storageSettings, retentionDays: parseInt(e.target.value) })}
                  min="1"
                  max="365"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={storageSettings.autoDeleteOldFiles}
                  onChange={(e) => setStorageSettings({ ...storageSettings, autoDeleteOldFiles: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Automatically delete old files</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={storageSettings.compressionEnabled}
                  onChange={(e) => setStorageSettings({ ...storageSettings, compressionEnabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Enable video compression</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={storageSettings.backupEnabled}
                  onChange={(e) => setStorageSettings({ ...storageSettings, backupEnabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Enable automatic backup</span>
              </label>
            </div>

            <button
              onClick={() => saveSettings('storage', storageSettings)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md"
            >
              {saving ? 'Saving...' : 'Save Storage Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};