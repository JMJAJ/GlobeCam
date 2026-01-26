import { motion } from 'framer-motion';
import { Activity, Camera, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ActivityEvent {
  id: string;
  type: 'detection' | 'connection' | 'alert';
  location: string;
  time: Date;
  camerasCount?: number;
}

export function ActivityTimeline() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    // Simulate live activity events
    const interval = setInterval(() => {
      const locations = ['Tokyo', 'New York', 'London', 'Berlin', 'Sydney', 'Mumbai', 'São Paulo'];
      const types: ActivityEvent['type'][] = ['detection', 'connection', 'alert'];
      
      const newEvent: ActivityEvent = {
        id: `event-${Date.now()}`,
        type: types[Math.floor(Math.random() * types.length)],
        location: locations[Math.floor(Math.random() * locations.length)],
        time: new Date(),
        camerasCount: Math.floor(Math.random() * 50) + 1
      };

      setEvents(prev => [newEvent, ...prev.slice(0, 4)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'detection':
        return <Activity className="w-3 h-3" />;
      case 'connection':
        return <Camera className="w-3 h-3" />;
      case 'alert':
        return <MapPin className="w-3 h-3" />;
    }
  };

  const getEventColor = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'detection':
        return 'text-blue-400';
      case 'connection':
        return 'text-green-400';
      case 'alert':
        return 'text-accent';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.7 }}
      className="hud-panel corner-accents"
    >
      <div className="border-b border-panel-border px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/70 flex items-center gap-2">
          <Activity className="w-3 h-3" />
          Live Activity
        </span>
      </div>
      <div className="p-3 space-y-2">
        {events.length === 0 && (
          <div className="text-center py-4 text-foreground/50 font-mono text-xs">
            Waiting for events...
          </div>
        )}
        {events.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-2 p-2 bg-secondary/20 rounded-sm"
          >
            <div className={`mt-0.5 ${getEventColor(event.type)}`}>
              {getEventIcon(event.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-foreground truncate">
                  {event.location}
                </span>
                <span className="font-mono text-[9px] text-foreground/50 whitespace-nowrap">
                  {event.time.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false 
                  })}
                </span>
              </div>
              {event.camerasCount && (
                <span className="font-mono text-[9px] text-foreground/60">
                  {event.camerasCount} cameras active
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
