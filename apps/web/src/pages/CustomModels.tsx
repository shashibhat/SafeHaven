import React, { useEffect, useState, useRef } from 'react';
import { useSystemStore } from '../stores/system';
import { CustomModel, ModelType, ModelStatus } from '@security-system/shared';
import {
  PlusIcon,
  TrashIcon,
  CogIcon,
  PlayIcon,
  PauseIcon,
  CameraIcon,
  SparklesIcon,
  ChartBarIcon,
  ArrowUpTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

export const CustomModels: React.FC = () => {
  const { customModels, fetchCustomModels, createCustomModel, updateCustomModel, deleteCustomModel } = useSystemStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null);
  const [trainingModel, setTrainingModel] = useState<string | null>(null);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'object_detection' as ModelType,
    classes: [] as string[],
    status: 'draft' as ModelStatus
  });
  const [classInput, setClassInput] = useState('');
  const [trainingSamples, setTrainingSamples] = useState<File[]>([]);
  const [testImage, setTestImage] = useState<File | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchCustomModels();
  }, [fetchCustomModels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingModel) {
      await updateCustomModel(editingModel.id, formData);
    } else {
      await createCustomModel(formData);
    }
    
    setShowAddModal(false);
    setEditingModel(null);
    setFormData({
      name: '',
      description: '',
      type: 'object_detection',
      classes: [],
      status: 'draft'
    });
  };

  const handleEdit = (model: CustomModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      description: model.description,
      type: model.type,
      classes: model.classes,
      status: model.status
    });
    setShowAddModal(true);
  };

  const handleDelete = async (modelId: string) => {
    if (confirm('Are you sure you want to delete this model?')) {
      await deleteCustomModel(modelId);
    }
  };

  const addClass = () => {
    if (classInput.trim() && !formData.classes.includes(classInput.trim())) {
      setFormData({
        ...formData,
        classes: [...formData.classes, classInput.trim()]
      });
      setClassInput('');
    }
  };

  const removeClass = (index: number) => {
    setFormData({
      ...formData,
      classes: formData.classes.filter((_, i) => i !== index)
    });
  };

  const handleTrainingFiles = (files: FileList) => {
    setTrainingSamples(Array.from(files));
  };

  const handleTestImage = (file: File) => {
    setTestImage(file);
  };

  const startTraining = async (modelId: string) => {
    setTrainingModel(modelId);
    
    const formData = new FormData();
    trainingSamples.forEach((file) => {
      formData.append('samples', file);
    });

    try {
      const response = await fetch(`/api/custom-models/${modelId}/train`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        alert('Training started successfully!');
      } else {
        alert('Training failed. Please try again.');
      }
    } catch (error) {
      console.error('Training error:', error);
      alert('Training failed. Please try again.');
    } finally {
      setTrainingModel(null);
      setTrainingSamples([]);
    }
  };

  const testModel = async (modelId: string) => {
    if (!testImage) {
      alert('Please select a test image first.');
      return;
    }

    setTestingModel(modelId);
    
    const formData = new FormData();
    formData.append('image', testImage);

    try {
      const response = await fetch(`/api/custom-models/${modelId}/test`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const results = await response.json();
        setTestResults(results);
      } else {
        alert('Testing failed. Please try again.');
      }
    } catch (error) {
      console.error('Testing error:', error);
      alert('Testing failed. Please try again.');
    } finally {
      setTestingModel(null);
    }
  };

  const deployModel = async (modelId: string) => {
    if (confirm('Are you sure you want to deploy this model?')) {
      try {
        const response = await fetch(`/api/custom-models/${modelId}/deploy`, {
          method: 'POST'
        });
        
        if (response.ok) {
          alert('Model deployed successfully!');
          fetchCustomModels();
        } else {
          alert('Deployment failed. Please try again.');
        }
      } catch (error) {
        console.error('Deployment error:', error);
        alert('Deployment failed. Please try again.');
      }
    }
  };

  const getStatusColor = (status: ModelStatus) => {
    switch (status) {
      case 'training': return 'bg-yellow-100 text-yellow-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'deployed': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: ModelType) => {
    switch (type) {
      case 'object_detection': return '🔍';
      case 'gesture_recognition': return '👋';
      case 'person_recognition': return '👤';
      case 'custom_classification': return '🏷️';
      default: return '🤖';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Detector Studio</h1>
          <p className="text-gray-600">Train custom AI models for specialized detection tasks</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Create Model</span>
        </button>
      </div>

      {/* Model Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customModels.map((model) => (
          <div key={model.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getTypeIcon(model.type)}</span>
                  <div>
                    <h3 className="font-medium text-gray-900">{model.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(model.status)}`}>
                      {model.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEdit(model)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <CogIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(model.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{model.description}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Classes */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Classes</h4>
                <div className="flex flex-wrap gap-1">
                  {model.classes.map((cls, index) => (
                    <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {cls}
                    </span>
                  ))}
                </div>
              </div>

              {/* Training Info */}
              {model.trainingStats && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Training Stats</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Accuracy: {(model.trainingStats.accuracy * 100).toFixed(1)}%</div>
                    <div>Samples: {model.trainingStats.sampleCount}</div>
                    <div>Epochs: {model.trainingStats.epochs}</div>
                    <div>Loss: {model.trainingStats.finalLoss.toFixed(4)}</div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2">
                {model.status === 'draft' && (
                  <label className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm cursor-pointer flex items-center space-x-1">
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    <span>Upload Samples</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleTrainingFiles(e.target.files!)}
                    />
                  </label>
                )}

                {model.status === 'draft' && trainingSamples.length > 0 && (
                  <button
                    onClick={() => startTraining(model.id)}
                    disabled={trainingModel === model.id}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
                  >
                    {trainingModel === model.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Training...</span>
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-4 w-4" />
                        <span>Train</span>
                      </>
                    )}
                  </button>
                )}

                {model.status === 'ready' && (
                  <>
                    <label className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm cursor-pointer flex items-center space-x-1">
                      <CameraIcon className="h-4 w-4" />
                      <span>Test</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleTestImage(e.target.files![0])}
                      />
                    </label>

                    <button
                      onClick={() => deployModel(model.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
                    >
                      <PlayIcon className="h-4 w-4" />
                      <span>Deploy</span>
                    </button>
                  </>
                )}

                {model.status === 'deployed' && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm">
                    ✓ Deployed
                  </span>
                )}
              </div>

              {/* Test Results */}
              {testResults && testImage && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Test Results</h5>
                  <div className="space-y-1 text-sm">
                    <div><strong>Predicted:</strong> {testResults.predictedClass}</div>
                    <div><strong>Confidence:</strong> {(testResults.confidence * 100).toFixed(1)}%</div>
                    {testResults.alternativePredictions && (
                      <div>
                        <strong>Alternatives:</strong>
                        <ul className="ml-4 mt-1 space-y-1">
                          {testResults.alternativePredictions.map((alt: any, index: number) => (
                            <li key={index} className="text-xs">
                              {alt.class}: {(alt.confidence * 100).toFixed(1)}%
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {customModels.length === 0 && (
        <div className="text-center py-12">
          <SparklesIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No custom models yet</h3>
          <p className="text-gray-600 mb-4">Create your first custom AI model for specialized detection</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Create Model
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
                  {editingModel ? 'Edit Model' : 'Create Model'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingModel(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model Name
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
                      Model Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as ModelType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="object_detection">Object Detection</option>
                      <option value="gesture_recognition">Gesture Recognition</option>
                      <option value="person_recognition">Person Recognition</option>
                      <option value="custom_classification">Custom Classification</option>
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
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classes (Objects to Detect)
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={classInput}
                      onChange={(e) => setClassInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addClass())}
                      placeholder="Enter class name (e.g., 'package', 'weapon', 'gesture')"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addClass}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.classes.map((cls, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {cls}
                        <button
                          type="button"
                          onClick={() => removeClass(index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {editingModel && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as ModelStatus })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="training">Training</option>
                      <option value="ready">Ready</option>
                      <option value="deployed">Deployed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingModel(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  {editingModel ? 'Update' : 'Create'} Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};