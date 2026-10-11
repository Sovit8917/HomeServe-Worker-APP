import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

type RealtimeCallback = (event: string, data: any) => void;

export function useRealtimeJobs(onEvent: RealtimeCallback, enabled: boolean = true) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    let activeSocket: any = null;
    let isMounted = true;

    getSocket('tracking')
      .then((socket) => {
        if (!isMounted) return;
        activeSocket = socket;

        const handleNewRequest = (data: any) => {
          onEventRef.current('booking:new_request', data);
        };

        const handleJobUpdated = (data: any) => {
          onEventRef.current('job:updated', data);
        };

        const handleStatusChanged = (data: any) => {
          onEventRef.current('job:status_changed', data);
        };

        const handleEarningsUpdated = (data: any) => {
          onEventRef.current('earnings:updated', data);
        };

        socket.on('booking:new_request', handleNewRequest);
        socket.on('job:updated', handleJobUpdated);
        socket.on('job_updated', handleJobUpdated);
        socket.on('job:status_changed', handleStatusChanged);
        socket.on('status_changed', handleStatusChanged);
        socket.on('earnings:updated', handleEarningsUpdated);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      if (activeSocket) {
        activeSocket.off('booking:new_request');
        activeSocket.off('job:updated');
        activeSocket.off('job_updated');
        activeSocket.off('job:status_changed');
        activeSocket.off('status_changed');
        activeSocket.off('earnings:updated');
      }
    };
  }, [enabled]);
}
