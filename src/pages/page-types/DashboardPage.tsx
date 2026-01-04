import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, LineChart, PieChart, Activity, Users, DollarSign, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";

interface DashboardPageProps {
  widgets: any[];
  title: string;
  data: any;
}

interface Widget {
  type: 'stats' | 'chart' | 'progress' | 'list' | 'custom';
  title: string;
  data: any;
  size?: 'small' | 'medium' | 'large';
}

const StatsWidget = ({ widget }: { widget: Widget }) => {
  const stats = widget.data?.stats || [
    { label: 'Total Users', value: '1,234', icon: Users, change: '+12%' },
    { label: 'Revenue', value: '$12,345', icon: DollarSign, change: '+8%' },
    { label: 'Active Sessions', value: '89', icon: Activity, change: '+23%' },
    { label: 'Growth Rate', value: '15.3%', icon: TrendingUp, change: '+4%' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {stats.map((stat: any, index: number) => {
        const Icon = stat.icon || Activity;
        return (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  {stat.change && (
                    <Badge variant={stat.change.startsWith('+') ? 'default' : 'destructive'} className="text-xs">
                      {stat.change}
                    </Badge>
                  )}
                </div>
                <Icon className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const ChartWidget = ({ widget }: { widget: Widget }) => {
  const chartType = widget.data?.chartType || 'bar';
  const chartData = widget.data?.chartData || [];

  const getChartIcon = () => {
    switch (chartType) {
      case 'line': return <LineChart className="h-8 w-8" />;
      case 'pie': return <PieChart className="h-8 w-8" />;
      default: return <BarChart className="h-8 w-8" />;
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          {getChartIcon()}
          <h3 className="text-lg font-semibold">{widget.title}</h3>
        </div>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <div className="mb-2">{getChartIcon()}</div>
            <p>Chart visualization would go here</p>
            <p className="text-xs">Data points: {chartData.length || 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProgressWidget = ({ widget }: { widget: Widget }) => {
  const progressItems = widget.data?.items || [
    { label: 'Project A', progress: 75, status: 'On Track' },
    { label: 'Project B', progress: 45, status: 'Behind' },
    { label: 'Project C', progress: 90, status: 'Ahead' }
  ];

  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="text-lg font-semibold">{widget.title}</h3>
        {progressItems.map((item: any, index: number) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{item.label}</span>
              <span className="text-muted-foreground">{item.progress}%</span>
            </div>
            <Progress value={item.progress} className="h-2" />
            <div className="text-xs text-muted-foreground">{item.status}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const ListWidget = ({ widget }: { widget: Widget }) => {
  const items = widget.data?.items || [
    { title: 'Recent Activity 1', subtitle: '2 minutes ago', status: 'new' },
    { title: 'Recent Activity 2', subtitle: '5 minutes ago', status: 'completed' },
    { title: 'Recent Activity 3', subtitle: '10 minutes ago', status: 'pending' }
  ];

  return (
    <Card>
      <CardContent>
        <h3 className="text-lg font-semibold mb-4">{widget.title}</h3>
        <div className="space-y-3">
          {items.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between border-b pb-2 last:border-b-0">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.subtitle}</p>
              </div>
              <Badge variant={item.status === 'new' ? 'default' : item.status === 'completed' ? 'secondary' : 'outline'}>
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const renderWidget = (widget: Widget, index: number) => {
  switch (widget.type) {
    case 'stats':
      return <StatsWidget key={index} widget={widget} />;
    case 'chart':
      return <ChartWidget key={index} widget={widget} />;
    case 'progress':
      return <ProgressWidget key={index} widget={widget} />;
    case 'list':
      return <ListWidget key={index} widget={widget} />;
    default:
      return (
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">{widget.title}</h3>
            <p className="text-muted-foreground">
              Widget type "{widget.type}" not implemented yet.
            </p>
          </CardContent>
        </Card>
      );
  }
};

export const DashboardPage = ({ widgets, title, data }: DashboardPageProps) => {
  const defaultWidgets: Widget[] = [
    { type: 'stats', title: 'Overview Stats', data: {} },
    { type: 'chart', title: 'Analytics Chart', data: { chartType: 'bar' } },
    { type: 'progress', title: 'Project Progress', data: {} },
    { type: 'list', title: 'Recent Activity', data: {} }
  ];

  const widgetsToRender = widgets && widgets.length > 0 ? widgets : defaultWidgets;

  return (
    <div className="space-y-6">
      <PageHeader 
        title={title}
        description={data?.lastUpdated ? `Last updated: ${new Date(data.lastUpdated).toLocaleString()}` : undefined}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {widgetsToRender.map((widget, index) => renderWidget(widget, index))}
      </div>
    </div>
  );
};