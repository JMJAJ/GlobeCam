import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity,
    Globe2,
    Radio,
    TrendingUp,
    MapPin,
    Clock,
    Eye,
    Shield,
    Database,
    Network,
    BarChart3,
    Target,
    Zap,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ChevronRight,
    Layers,
    Signal,
    Users,
    FileSearch,
    Timer,
    Hash,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Search,
    Filter,
    Calendar,
    PieChart,
    Crosshair,
    ArrowLeft,
    Download,
    Share2,
    Bell,
    Settings,
    Maximize2,
    RefreshCw,
    Lock,
    Unlock,
    Cpu,
    HardDrive,
    Wifi,
    MapPinned,
    TrendingDown,
    Radar
} from 'lucide-react';
import { CameraData } from '@/types/camera';

interface OSINTBoardProps {
    isOpen: boolean;
    cameras: CameraData[];
    stats: {
        total: number;
        online: number;
        byContinent: Record<string, number>;
        byCountry: Record<string, number>;
    };
    onClose?: () => void;
}

// Simulated live activity data
function generateLiveActivity(cameras: CameraData[]) {
    const activities = [
        { type: 'connection', text: 'Connection established', icon: 'link' },
        { type: 'stream', text: 'Data stream active', icon: 'radio' },
        { type: 'motion', text: 'Motion detected', icon: 'eye' },
        { type: 'quality', text: 'Feed quality optimal', icon: 'check' },
        { type: 'latency', text: 'Network latency low', icon: 'zap' },
        { type: 'signal', text: 'Signal strength high', icon: 'signal' },
        { type: 'recording', text: 'Recording active', icon: 'record' },
        { type: 'buffer', text: 'Stream buffering', icon: 'loader' },
    ];

    const shuffled = [...cameras].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10).map((cam, i) => ({
        id: cam.id,
        location: `${cam.city || 'Unknown'}, ${cam.country}`,
        country: cam.country,
        continent: cam.continent,
        activity: activities[i % activities.length],
        timestamp: new Date(Date.now() - Math.random() * 3600000),
        status: (Math.random() > 0.15 ? 'active' : Math.random() > 0.5 ? 'warning' : 'error') as 'active' | 'warning' | 'error',
        coordinates: { lat: cam.latitude, lon: cam.longitude },
    }));
}

// Generate source distribution
function generateSourceDistribution(cameras: CameraData[]) {
    const sources: Record<string, number> = {};
    cameras.forEach(cam => {
        const source = (cam as any).source || 'Unknown';
        sources[source] = (sources[source] || 0) + 1;
    });
    return Object.entries(sources)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6);
}

// Generate hourly activity pattern
function generateHourlyPattern() {
    return Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        value: 40 + Math.random() * 60,
    }));
}

// Generate threat levels
function generateThreatLevels() {
    return [
        { region: 'Asia Pacific', level: 'Low', value: 23, color: 'emerald' },
        { region: 'Europe', level: 'Low', value: 18, color: 'emerald' },
        { region: 'North America', level: 'Medium', value: 45, color: 'amber' },
        { region: 'South America', level: 'Low', value: 12, color: 'emerald' },
        { region: 'Africa', level: 'Low', value: 8, color: 'emerald' },
        { region: 'Oceania', level: 'Low', value: 5, color: 'emerald' },
    ];
}

interface IntelCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'stable';
    trendValue?: string;
    color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    delay?: number;
    compact?: boolean;
}

function IntelCard({ title, value, subtitle, icon, trend, trendValue, color = 'default', delay = 0, compact = false }: IntelCardProps) {
    const colorClasses = {
        default: 'text-white/90',
        success: 'text-emerald-400',
        warning: 'text-amber-400',
        danger: 'text-red-400',
        info: 'text-cyan-400',
    };

    const trendIcons = {
        up: <ArrowUpRight className="w-4 h-4" />,
        down: <ArrowDownRight className="w-4 h-4" />,
        stable: <Minus className="w-4 h-4" />,
    };

    const trendColors = {
        up: 'text-emerald-400',
        down: 'text-red-400',
        stable: 'text-white/40',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay }}
            className={`hud-panel corner-accents relative overflow-hidden group ${compact ? 'p-4' : 'p-5'}`}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex items-start justify-between relative z-10">
                <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1.5 truncate">
                        {title}
                    </div>
                    <div className={`font-mono ${compact ? 'text-2xl' : 'text-3xl'} font-medium ${colorClasses[color]} truncate`}>
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </div>
                    {subtitle && (
                        <div className="font-mono text-[11px] text-white/40 mt-1.5 truncate">{subtitle}</div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-3">
                    <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-md bg-accent/10 flex items-center justify-center text-accent`}>
                        {icon}
                    </div>
                    {trend && (
                        <div className={`flex items-center gap-1 text-[11px] font-mono ${trendColors[trend]}`}>
                            {trendIcons[trend]}
                            {trendValue || (trend === 'up' ? '+12%' : trend === 'down' ? '-8%' : '0%')}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

interface ActivityItemProps {
    location: string;
    activity: { type: string; text: string };
    timestamp: Date;
    status: 'active' | 'warning' | 'error';
    continent?: string;
    delay?: number;
}

function ActivityItem({ location, activity, timestamp, status, continent, delay = 0 }: ActivityItemProps) {
    const statusIcons = {
        active: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        error: <XCircle className="w-4 h-4 text-red-400" />,
    };

    const statusColors = {
        active: 'border-l-emerald-400/50',
        warning: 'border-l-amber-400/50',
        error: 'border-l-red-400/50',
    };

    const timeDiff = Math.floor((Date.now() - timestamp.getTime()) / 60000);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay }}
            className={`flex items-center gap-3 py-2.5 px-4 bg-white/[0.02] hover:bg-white/[0.05] transition-colors rounded-md group cursor-default border-l-2 ${statusColors[status]}`}
        >
            <div className="flex-shrink-0">{statusIcons[status]}</div>
            <div className="flex-1 min-w-0">
                <div className="font-mono text-[13px] text-white/90 truncate">{location}</div>
                <div className="font-mono text-[11px] text-white/40 truncate flex items-center gap-2">
                    <span>{activity.text}</span>
                    {continent && <span className="text-accent/60">• {continent}</span>}
                </div>
            </div>
            <div className="flex-shrink-0 font-mono text-[11px] text-white/30">
                {timeDiff}m ago
            </div>
        </motion.div>
    );
}

interface RegionBarProps {
    region: string;
    count: number;
    maxCount: number;
    delay?: number;
    color?: string;
}

function RegionBar({ region, count, maxCount, delay = 0 }: RegionBarProps) {
    const percentage = (count / maxCount) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay }}
            className="flex items-center gap-4 py-2"
        >
            <div className="w-28 font-mono text-[12px] text-white/70 truncate">{region}</div>
            <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(to right, hsl(45, 15%, 50%), hsl(45, 20%, 65%))` }}
                />
            </div>
            <span className="font-mono text-[12px] text-white/50 w-16 text-right tabular-nums">
                {count.toLocaleString()}
            </span>
        </motion.div>
    );
}

interface HourlyChartProps {
    data: { hour: number; value: number }[];
    delay?: number;
}

function HourlyChart({ data, delay = 0 }: HourlyChartProps) {
    const maxValue = Math.max(...data.map(d => d.value));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay }}
            className="flex items-end gap-1 h-20"
        >
            {data.map((d, i) => (
                <motion.div
                    key={d.hour}
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.value / maxValue) * 100}%` }}
                    transition={{ duration: 0.4, delay: delay + i * 0.02 }}
                    className="flex-1 bg-accent/40 hover:bg-accent/60 transition-colors rounded-t cursor-default group relative"
                >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-black/90 px-2 py-1 rounded text-[10px] font-mono text-white whitespace-nowrap">
                            {d.hour}:00 - {Math.round(d.value)}%
                        </div>
                    </div>
                </motion.div>
            ))}
        </motion.div>
    );
}

interface EntityCardProps {
    entity: {
        type: string;
        name: string;
        count: number;
        trend: 'up' | 'down' | 'stable';
    };
    delay?: number;
}

function EntityCard({ entity, delay = 0 }: EntityCardProps) {
    const typeIcons: Record<string, React.ReactNode> = {
        country: <MapPin className="w-4 h-4" />,
        city: <Target className="w-4 h-4" />,
        source: <Database className="w-4 h-4" />,
        network: <Network className="w-4 h-4" />,
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay }}
            className="hud-panel p-3 flex items-center gap-3 hover:bg-white/[0.03] transition-colors cursor-default"
        >
            <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center text-accent/70">
                {typeIcons[entity.type] || <Hash className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-mono text-[12px] text-white/80 truncate">{entity.name}</div>
                <div className="font-mono text-[10px] text-white/40">{entity.count.toLocaleString()} feeds</div>
            </div>
            <div className={`text-[11px] ${entity.trend === 'up' ? 'text-emerald-400' : entity.trend === 'down' ? 'text-red-400' : 'text-white/30'}`}>
                {entity.trend === 'up' ? '↑' : entity.trend === 'down' ? '↓' : '–'}
            </div>
        </motion.div>
    );
}

interface ThreatCardProps {
    region: string;
    level: string;
    value: number;
    color: string;
    delay?: number;
}

function ThreatCard({ region, level, value, color, delay = 0 }: ThreatCardProps) {
    const colorMap: Record<string, string> = {
        emerald: 'text-emerald-400 bg-emerald-400/10',
        amber: 'text-amber-400 bg-amber-400/10',
        red: 'text-red-400 bg-red-400/10',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay }}
            className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-md hover:bg-white/[0.04] transition-colors"
        >
            <span className="font-mono text-[11px] text-white/70">{region}</span>
            <div className={`px-2 py-0.5 rounded text-[10px] font-mono ${colorMap[color]}`}>
                {level}
            </div>
        </motion.div>
    );
}

export function OSINTBoard({ isOpen, cameras, stats, onClose }: OSINTBoardProps) {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const liveActivity = useMemo(() => generateLiveActivity(cameras), [cameras]);
    const sourceDistribution = useMemo(() => generateSourceDistribution(cameras), [cameras]);
    const hourlyPattern = useMemo(() => generateHourlyPattern(), []);
    const threatLevels = useMemo(() => generateThreatLevels(), []);

    // Top countries by camera count
    const topCountries = useMemo(() => {
        return Object.entries(stats.byCountry)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);
    }, [stats.byCountry]);

    // Top regions by camera count
    const topRegions = useMemo(() => {
        return Object.entries(stats.byContinent)
            .sort(([, a], [, b]) => b - a);
    }, [stats.byContinent]);

    // Calculate max for bars
    const maxCountryCount = topCountries[0]?.[1] || 1;
    const maxRegionCount = topRegions[0]?.[1] || 1;

    // Tracked entities
    const trackedEntities = useMemo(() => {
        const trends = ['up', 'down', 'stable'] as const;
        const countries = topCountries.slice(0, 4).map(([name, count]) => ({
            type: 'country' as const,
            name,
            count,
            trend: trends[Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
        }));
        return countries;
    }, [topCountries]);

    // Coverage percentage
    const coveragePercent = ((stats.total - (stats.byContinent['Other'] || 0)) / stats.total * 100).toFixed(1);

    // Handle refresh
    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 z-40 flex bg-background"
                >
                    {/* Main OSINT Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="flex-1 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 px-6 py-5 border-b border-border/30 bg-background/95 backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    {/* Back to Globe Button */}
                                    <button
                                        onClick={onClose}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                                    >
                                        <ArrowLeft className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
                                        <span className="font-mono text-[12px] uppercase tracking-wider text-white/70 group-hover:text-white transition-colors">
                                            Back to Globe
                                        </span>
                                    </button>

                                    <div className="h-8 w-px bg-white/10" />

                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-md bg-emerald-400/10 flex items-center justify-center">
                                            <Shield className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h2 className="font-mono text-base font-medium text-white uppercase tracking-wider flex items-center gap-3">
                                                OSINT Overview
                                                <span className="text-[10px] px-2 py-1 rounded bg-emerald-400/20 text-emerald-400">LIVE</span>
                                            </h2>
                                            <p className="font-mono text-[11px] text-white/50 uppercase tracking-widest">
                                                Global Surveillance Intelligence Dashboard
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Search */}
                                    <div className="relative hidden lg:block">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search intel..."
                                            className="w-72 bg-white/5 border border-white/10 rounded-md pl-12 pr-4 py-2.5 font-mono text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition-colors"
                                        />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleRefresh}
                                            className={`p-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                                        >
                                            <RefreshCw className="w-5 h-5 text-white/60" />
                                        </button>
                                        <button className="p-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                                            <Bell className="w-5 h-5 text-white/60" />
                                        </button>
                                        <button className="p-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                                            <Download className="w-5 h-5 text-white/60" />
                                        </button>
                                    </div>

                                    <div className="h-8 w-px bg-white/10" />

                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="font-mono text-[12px] text-emerald-400 uppercase tracking-wider">
                                            ONLINE
                                        </span>
                                    </div>
                                    <div className="font-mono text-sm text-white/60 tabular-nums">
                                        {currentTime.toLocaleTimeString(undefined, { hour12: false })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Grid */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-6 max-w-[1800px] mx-auto">
                                {/* Top Stats Row */}
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                    <IntelCard
                                        title="Total Assets"
                                        value={stats.total}
                                        subtitle="Global network"
                                        icon={<Database className="w-5 h-5" />}
                                        trend="up"
                                        trendValue="+2.3%"
                                        delay={0.1}
                                        compact
                                    />
                                    <IntelCard
                                        title="Active Nodes"
                                        value={stats.online}
                                        subtitle={`${((stats.online / stats.total) * 100).toFixed(1)}% online`}
                                        icon={<Signal className="w-5 h-5" />}
                                        color="success"
                                        delay={0.12}
                                        compact
                                    />
                                    <IntelCard
                                        title="Coverage"
                                        value={`${coveragePercent}%`}
                                        subtitle="Identified locations"
                                        icon={<Crosshair className="w-5 h-5" />}
                                        color="info"
                                        delay={0.14}
                                        compact
                                    />
                                    <IntelCard
                                        title="Regions"
                                        value={Object.keys(stats.byContinent).length}
                                        subtitle="Active continents"
                                        icon={<Globe2 className="w-5 h-5" />}
                                        delay={0.16}
                                        compact
                                    />
                                    <IntelCard
                                        title="Countries"
                                        value={Object.keys(stats.byCountry).length}
                                        subtitle="Nations monitored"
                                        icon={<MapPin className="w-5 h-5" />}
                                        trend="stable"
                                        delay={0.18}
                                        compact
                                    />
                                </div>

                                {/* Main Grid - 4 columns on large screens */}
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                                    {/* Column 1 - Activity Feed */}
                                    <div className="space-y-5">
                                        {/* Live Activity */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: 0.2 }}
                                            className="hud-panel corner-accents flex flex-col"
                                        >
                                            <div className="flex-shrink-0 px-5 py-4 border-b border-border/30 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Activity className="w-5 h-5 text-emerald-400" />
                                                    <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                                        Live Activity
                                                    </span>
                                                </div>
                                                <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                    Real-time
                                                </span>
                                            </div>
                                            <div className="p-3 space-y-2 max-h-[450px] overflow-y-auto">
                                                {liveActivity.map((item, i) => (
                                                    <ActivityItem
                                                        key={item.id}
                                                        location={item.location}
                                                        activity={item.activity}
                                                        timestamp={item.timestamp}
                                                        status={item.status}
                                                        continent={item.continent}
                                                        delay={0.25 + i * 0.03}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Column 2 - Regional Analytics */}
                                    <div className="space-y-5">
                                        {/* Regional Distribution */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: 0.25 }}
                                            className="hud-panel corner-accents"
                                        >
                                            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <PieChart className="w-5 h-5 text-accent" />
                                                    <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                                        Regional Coverage
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-5 space-y-1">
                                                {topRegions.map(([region, count], i) => (
                                                    <RegionBar
                                                        key={region}
                                                        region={region}
                                                        count={count}
                                                        maxCount={maxRegionCount}
                                                        delay={0.3 + i * 0.05}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>

                                        {/* Threat Assessment */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: 0.35 }}
                                            className="hud-panel corner-accents"
                                        >
                                            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Radar className="w-5 h-5 text-amber-400" />
                                                    <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                                        Threat Assessment
                                                    </span>
                                                </div>
                                                <span className="font-mono text-[10px] text-emerald-400 px-2 py-0.5 rounded bg-emerald-400/10">
                                                    LOW RISK
                                                </span>
                                            </div>
                                            <div className="p-4 space-y-2">
                                                {threatLevels.map((threat, i) => (
                                                    <ThreatCard
                                                        key={threat.region}
                                                        region={threat.region}
                                                        level={threat.level}
                                                        value={threat.value}
                                                        color={threat.color}
                                                        delay={0.4 + i * 0.04}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Column 3 - Analytics */}
                                    <div className="space-y-5">
                                        {/* Top Countries */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: 0.3 }}
                                            className="hud-panel corner-accents"
                                        >
                                            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <BarChart3 className="w-5 h-5 text-accent" />
                                                    <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                                        Top Countries
                                                    </span>
                                                </div>
                                                <span className="font-mono text-[10px] text-white/40">
                                                    by asset count
                                                </span>
                                            </div>
                                            <div className="p-5 space-y-1">
                                                {topCountries.slice(0, 8).map(([country, count], i) => (
                                                    <RegionBar
                                                        key={country}
                                                        region={country}
                                                        count={count}
                                                        maxCount={maxCountryCount}
                                                        delay={0.35 + i * 0.04}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>

                                        {/* Hourly Activity */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: 0.4 }}
                                            className="hud-panel corner-accents"
                                        >
                                            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Timer className="w-5 h-5 text-accent" />
                                                    <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                                        24h Activity
                                                    </span>
                                                </div>
                                                <span className="font-mono text-[10px] text-white/40">
                                                    UTC
                                                </span>
                                            </div>
                                            <div className="p-5">
                                                <HourlyChart data={hourlyPattern} delay={0.45} />
                                                <div className="flex justify-between mt-3 text-[10px] font-mono text-white/30">
                                                    <span>00:00</span>
                                                    <span>06:00</span>
                                                    <span>12:00</span>
                                                    <span>18:00</span>
                                                    <span>24:00</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Column 4 - System & Entities */}
                                    <div className="space-y-5">
                                        {/* Tracked Entities */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: 0.35 }}
                                            className="hud-panel corner-accents"
                                        >
                                            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Target className="w-5 h-5 text-accent" />
                                                    <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                                        Tracked Entities
                                                    </span>
                                                </div>
                                                <button className="font-mono text-[11px] text-accent/70 hover:text-accent transition-colors">
                                                    + Add Entity
                                                </button>
                                            </div>
                                            <div className="p-3 space-y-2">
                                                {trackedEntities.map((entity, i) => (
                                                    <EntityCard key={entity.name} entity={entity} delay={0.4 + i * 0.05} />
                                                ))}
                                            </div>
                                        </motion.div>

                                        {/* System Status */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: 0.45 }}
                                            className="hud-panel corner-accents"
                                        >
                                            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Layers className="w-5 h-5 text-accent" />
                                                    <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                                        System Status
                                                    </span>
                                                </div>
                                                <span className="font-mono text-[10px] text-emerald-400">
                                                    All Operational
                                                </span>
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-3">
                                                {[
                                                    { label: 'Data Streams', value: '99.8%', icon: <Radio className="w-4 h-4" /> },
                                                    { label: 'API Gateway', value: '100%', icon: <Zap className="w-4 h-4" /> },
                                                    { label: 'CDN Network', value: '99.9%', icon: <Wifi className="w-4 h-4" /> },
                                                    { label: 'Analytics', value: '98.5%', icon: <Cpu className="w-4 h-4" /> },
                                                ].map((item, i) => (
                                                    <motion.div
                                                        key={item.label}
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
                                                        className="flex items-center justify-between py-2.5 px-3 bg-white/[0.02] rounded-md"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-emerald-400/70">{item.icon}</div>
                                                            <span className="font-mono text-[10px] text-white/70">{item.label}</span>
                                                        </div>
                                                        <span className="font-mono text-[11px] text-emerald-400 tabular-nums">{item.value}</span>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>

                                        {/* Quick Actions */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: 0.5 }}
                                            className="hud-panel corner-accents p-4"
                                        >
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { icon: <FileSearch className="w-5 h-5" />, label: 'Export Report' },
                                                    { icon: <Filter className="w-5 h-5" />, label: 'Add Filter' },
                                                    { icon: <Share2 className="w-5 h-5" />, label: 'Share Intel' },
                                                    { icon: <Settings className="w-5 h-5" />, label: 'Configure' },
                                                ].map((action) => (
                                                    <button
                                                        key={action.label}
                                                        className="flex items-center gap-3 py-3 px-4 bg-white/[0.02] hover:bg-white/[0.06] rounded-md transition-colors border border-transparent hover:border-white/10"
                                                    >
                                                        <span className="text-accent/70">{action.icon}</span>
                                                        <span className="font-mono text-[11px] text-white/70">{action.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Sidebar - Globe View Space (the actual globe is positioned by parent) */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="hidden lg:flex flex-col w-[460px] border-l border-border/30 bg-background/50"
                    >
                        {/* Mini Globe Header */}
                        <div className="flex-shrink-0 px-5 py-4 border-b border-border/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Globe2 className="w-5 h-5 text-accent" />
                                <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                    Live Globe View
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="font-mono text-[11px] text-white/50">
                                    {cameras.length.toLocaleString()} nodes
                                </span>
                            </div>
                        </div>

                        {/* Globe Container Area - placeholder, actual globe rendered by parent */}
                        <div className="flex-1 flex flex-col justify-start p-5">
                            {/* The globe is positioned here by the parent component */}
                            <div
                                className="relative w-full rounded-xl overflow-hidden border border-border/30 bg-black/20"
                                style={{ aspectRatio: '16/9', height: '236px' }}
                            >
                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
                            </div>

                            {/* Quick Stats below globe */}
                            <div className="mt-5 grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Online', value: stats.online, color: 'text-emerald-400' },
                                    { label: 'Regions', value: Object.keys(stats.byContinent).length, color: 'text-accent' },
                                    { label: 'Countries', value: Object.keys(stats.byCountry).length, color: 'text-cyan-400' },
                                ].map((stat) => (
                                    <div key={stat.label} className="text-center py-3 px-4 bg-white/[0.02] rounded-md">
                                        <div className={`font-mono text-xl font-medium ${stat.color}`}>
                                            {stat.value.toLocaleString()}
                                        </div>
                                        <div className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Data Sources */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.5 }}
                                className="mt-5 hud-panel corner-accents"
                            >
                                <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Database className="w-5 h-5 text-accent" />
                                        <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                            Data Sources
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 space-y-2">
                                    {sourceDistribution.map(([source, count]) => (
                                        <div key={source} className="flex items-center justify-between py-1">
                                            <span className="font-mono text-[11px] text-white/70">{source || 'Unknown'}</span>
                                            <span className="font-mono text-[11px] text-accent tabular-nums">{count.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Network Health */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.55 }}
                                className="mt-5 hud-panel corner-accents"
                            >
                                <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Network className="w-5 h-5 text-emerald-400" />
                                        <span className="font-mono text-[12px] uppercase tracking-widest text-white/80">
                                            Network Health
                                        </span>
                                    </div>
                                    <span className="font-mono text-[10px] text-emerald-400">OPTIMAL</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    {[
                                        { label: 'Latency', value: '23ms', status: 'good' },
                                        { label: 'Packet Loss', value: '0.01%', status: 'good' },
                                        { label: 'Bandwidth', value: '12.4 Gbps', status: 'good' },
                                    ].map((metric) => (
                                        <div key={metric.label} className="flex items-center justify-between">
                                            <span className="font-mono text-[11px] text-white/60">{metric.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[11px] text-white/80 tabular-nums">{metric.value}</span>
                                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
