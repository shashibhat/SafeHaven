import React, { useEffect, useState } from 'react';
import { useSystemStore } from '../stores/system';
import { Event, EventType, EventSeverity } from '@security-system/shared';
import {
  FunnelIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  VideoCameraIcon,
  UserIcon,
  ArchiveBoxIcon,
  FaceSmileIcon,
  HandRaisedIcon
} from '@heroicons/react/24/outline';

export const Events: React.FC = () => {
  const { events, incidents, fetchEvents, fetchIncidents } = useSystemStore();
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<EventSeverity | 'all'>('all');
  const [filterCamera, setFilterCamera] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');

  useEffect(() => {
    fetchEvents();
    fetchIncidents();
  }, [fetchEvents, fetchIncidents]);

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.timestamp);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    const matchesType = filterType === 'all' || event.type === filterType;
    const matchesSeverity = filterSeverity === 'all' || event.severity === filterSeverity;
    const matchesCamera = filterCamera === 'all' || event.cameraId === filterCamera;
    const matchesDate = eventDate >= startDate && eventDate <= endDate;

    return matchesType && matchesSeverity && matchesCamera && matchesDate;
  });

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'person_detected': return <UserIcon className="h-5 w-5" />;
      case 'motion_detected': return <HandRaisedIcon className="h-5 w-5" />;
      case 'package_detected': return <ArchiveBoxIcon className="h-5 w-5" />;
      case 'face_recognized': return <FaceSmileIcon className="h-5 w-5" />;
      case 'zone_violation': return <ExclamationTriangleIcon className="h-5 w-5" />;
      default: return <VideoCameraIcon className="h-5 w-5" />;
    }
  };

  const getSeverityColor = (severity: EventSeverity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEventColor = (type: EventType) => {
    switch (type) {
      case 'person_detected': return 'bg-blue-100 text-blue-600';
      case 'motion_detected': return 'bg-orange-100 text-orange-600';
      case 'package_detected': return 'bg-green-100 text-green-600';
      case 'face_recognized': return 'bg-purple-100 text-purple-600';
      case 'zone_violation': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const cameras = [...new Set(events.map(e => e.cameraId))];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Events</h1>
          <p className="text-gray-600">Monitor and analyze security events</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'timeline' ? 'bg-white shadow-sm' : 'text-gray-600'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600'
              }`}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4 mb-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-900">Filters</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EventType | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="person_detected">Person Detected</option>
              <option value="motion_detected">Motion Detected</option>
              <option value="package_detected">Package Detected</option>
              <option value="face_recognized">Face Recognized</option>
              <option value="zone_violation">Zone Violation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as EventSeverity | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
            <select
              value={filterCamera}
              onChange={(e) => setFilterCamera(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Cameras</option>
              {cameras.map(cameraId => (
                <option key={cameraId} value={cameraId}>
                  Camera {cameraId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-48"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{filteredEvents.length}</p>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg">
              <ClockIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Severity</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredEvents.filter(e => e.severity === 'high').length}
              </p>
            </div>
            <div className="bg-red-100 p-2 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Person Detections</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredEvents.filter(e => e.type === 'person_detected').length}
              </p>
            </div>
            <div className="bg-purple-100 p-2 rounded-lg">
              <UserIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Motion Events</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredEvents.filter(e => e.type === 'motion_detected').length}
              </p>
            </div>
            <div className="bg-orange-100 p-2 rounded-lg">
              <HandRaisedIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Events Display */}
      {viewMode === 'timeline' ? (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Event Timeline</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12">
                  <ClockIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
                  <p className="text-gray-600">Try adjusting your filters</p>
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className={`p-2 rounded-lg ${getEventColor(event.type)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-gray-900">
                          {event.type.replace('_', ' ').toUpperCase()}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                          getSeverityColor(event.severity)
                        }`}>
                          {event.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Camera: {event.cameraName}</span>
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                        {event.confidence && <span>Confidence: {(event.confidence * 100).toFixed(1)}%</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md cursor-pointer"
              onClick={() => setSelectedEvent(event)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${getEventColor(event.type)}`}>
                  {getEventIcon(event.type)}
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                  getSeverityColor(event.severity)
                }`}>
                  {event.severity}
                </span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">
                {event.type.replace('_', ' ').toUpperCase()}
              </h3>
              <p className="text-sm text-gray-600 mb-3">{event.description}</p>
              <div className="space-y-1 text-xs text-gray-500">
                <div>Camera: {event.cameraName}</div>
                <div>{new Date(event.timestamp).toLocaleString()}</div>
                {event.confidence && <div>Confidence: {(event.confidence * 100).toFixed(1)}%</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Event Details</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${getEventColor(selectedEvent.type)}`}>
                  {getEventIcon(selectedEvent.type)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {selectedEvent.type.replace('_', ' ').toUpperCase()}
                  </h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                    getSeverityColor(selectedEvent.severity)
                  }`}>
                    {selectedEvent.severity}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
                  <p className="text-sm text-gray-900">{selectedEvent.cameraName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </p>
                </div>
                {selectedEvent.confidence && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confidence</label>
                    <p className="text-sm text-gray-900">
                      {(selectedEvent.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
                {selectedEvent.zone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                    <p className="text-sm text-gray-900">{selectedEvent.zone}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-sm text-gray-900">{selectedEvent.description}</p>
              </div>

              {selectedEvent.metadata && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Data</label>
                  <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.mediaUrl && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Media</label>
                  <img
                    src={`/api/media/${selectedEvent.mediaUrl}`}
                    alt="Event media"
                    className="w-full rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
