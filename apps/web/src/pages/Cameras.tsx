import React, { useEffect, useState } from 'react';
import { useSystemStore } from '../stores/system';
import { Camera, CameraType, CameraStatus } from '@security-system/shared';
import {
  VideoCameraIcon,
  PlusIcon,
  CogIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export const Cameras: React.FC = () => {
  const { cameras, fetchCameras, createCamera, updateCamera, deleteCamera } = useSystemStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'rtsp' as CameraType,
    url: '',
    resolution: '1920x1080',
    fps: 30,
    zones: [] as any[]
  });

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCamera) {
      await updateCamera(editingCamera.id, formData);
    } else {
      await createCamera(formData);
    }
    
    setShowAddModal(false);
    setEditingCamera(null);
    setFormData({
      name: '',
      type: 'rtsp',
      url: '',
      resolution: '1920x1080',
      fps: 30,
      zones: []
    });
  };

  const handleEdit = (camera: Camera) => {
    setEditingCamera(camera);
    setFormData({
      name: camera.name,
      type: camera.type,
      url: camera.url,
      resolution: camera.resolution,
      fps: camera.fps,
      zones: camera.zones || []
    });
    setShowAddModal(true);
  };

  const handleDelete = async (cameraId: string) => {
    if (confirm('Are you sure you want to delete this camera?')) {
      await deleteCamera(cameraId);
    }
  };

  const getStatusColor = (status: CameraStatus) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'offline': return 'bg-red-100 text-red-800';
      case 'error': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: CameraType) => {
    switch (type) {
      case 'rtsp': return '📹';
      case 'usb': return '🔌';
      case 'onvif': return '🌐';
      default: return '📷';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Camera Management</h1>
          <p className="text-gray-600">Configure and monitor your security cameras</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Add Camera</span>
        </button>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cameras.map((camera) => (
          <div key={camera.id} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Camera Preview */}
            <div className="aspect-video bg-gray-900 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoCameraIcon className="h-16 w-16 text-gray-400" />
              </div>
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(camera.status)}`}>
                  {camera.status}
                </span>
              </div>
            </div>

            {/* Camera Info */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getTypeIcon(camera.type)}</span>
                  <h3 className="font-medium text-gray-900">{camera.name}</h3>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEdit(camera)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <CogIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(camera.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="capitalize">{camera.type}</span>
                </div>
                <div className="flex justify-between">
                  <span>Resolution:</span>
                  <span>{camera.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span>FPS:</span>
                  <span>{camera.fps}</span>
                </div>
                <div className="flex justify-between">
                  <span>Zones:</span>
                  <span>{camera.zones?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Seen:</span>
                  <span>{new Date(camera.lastSeen).toLocaleString()}</span>
                </div>
              </div>

              {camera.status === 'error' && camera.error && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-700">{camera.error}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {cameras.length === 0 && (
        <div className="text-center py-12">
          <VideoCameraIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No cameras configured</h3>
          <p className="text-gray-600 mb-4">Add your first camera to start monitoring</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Add Camera
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingCamera ? 'Edit Camera' : 'Add Camera'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCamera(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Camera Name
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
                    Camera Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as CameraType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="rtsp">RTSP Camera</option>
                    <option value="usb">USB Camera</option>
                    <option value="onvif">ONVIF Camera</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stream URL
                  </label>
                  <input
                    type="text"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder={formData.type === 'rtsp' ? 'rtsp://username:password@ip:port/stream' : '/dev/video0'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resolution
                    </label>
                    <select
                      value={formData.resolution}
                      onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="640x480">640x480</option>
                      <option value="1280x720">1280x720</option>
                      <option value="1920x1080">1920x1080</option>
                      <option value="2560x1440">2560x1440</option>
                      <option value="3840x2160">3840x2160</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      FPS
                    </label>
                    <input
                      type="number"
                      value={formData.fps}
                      onChange={(e) => setFormData({ ...formData, fps: parseInt(e.target.value) })}
                      min="1"
                      max="60"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCamera(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  {editingCamera ? 'Update' : 'Add'} Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};