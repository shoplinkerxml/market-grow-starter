/**
 * Role Assignment Monitoring Service
 * 
 * This service provides monitoring capabilities for user role assignments
 * to detect any regressions or issues with the role assignment fix.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/types';

interface RoleAssignmentMetrics {
  total_users: number;
  admin_count: number;
  manager_count: number;
  user_count: number;
  recent_registrations_24h: number;
  recent_user_assignments_24h: number;
  potential_issues: number;
  last_checked: string;
}

interface RoleAssignmentAlert {
  type: 'warning' | 'error' | 'info';
  message: string;
  details: any;
  timestamp: string;
}

export class RoleAssignmentMonitor {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }

  /**
   * Get current role assignment metrics
   */
  async getRoleMetrics(): Promise<RoleAssignmentMetrics | null> {
    try {
      // Get total counts by role
      const { data: profiles, error: profilesError } = await this.supabase
        .from('profiles')
        .select('role, created_at');

      if (profilesError) {
        console.error('Error fetching profile metrics:', profilesError);
        return null;
      }

      // Calculate metrics
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const metrics: RoleAssignmentMetrics = {
        total_users: profiles.length,
        admin_count: profiles.filter(p => p.role === 'admin').length,
        manager_count: profiles.filter(p => p.role === 'manager').length,
        user_count: profiles.filter(p => p.role === 'user').length,
        recent_registrations_24h: profiles.filter(p => 
          new Date(p.created_at) > yesterday
        ).length,
        recent_user_assignments_24h: profiles.filter(p => 
          p.role === 'user' && new Date(p.created_at) > yesterday
        ).length,
        potential_issues: profiles.filter(p => 
          p.role === 'manager' && new Date(p.created_at) > yesterday
        ).length,
        last_checked: now.toISOString()
      };

      return metrics;

    } catch (error) {
      console.error('Error getting role metrics:', error);
      return null;
    }
  }

  /**
   * Check for role assignment issues and generate alerts
   */
  async checkForIssues(): Promise<RoleAssignmentAlert[]> {
    const alerts: RoleAssignmentAlert[] = [];
    const metrics = await this.getRoleMetrics();

    if (!metrics) {
      alerts.push({
        type: 'error',
        message: 'Failed to retrieve role assignment metrics',
        details: {},
        timestamp: new Date().toISOString()
      });
      return alerts;
    }

    // Alert 1: Check for potential manager role assignment issues
    if (metrics.potential_issues > 0) {
      alerts.push({
        type: 'warning',
        message: `${metrics.potential_issues} users assigned 'manager' role in last 24h - may indicate regression`,
        details: {
          recent_manager_assignments: metrics.potential_issues,
          total_recent_registrations: metrics.recent_registrations_24h
        },
        timestamp: new Date().toISOString()
      });
    }

    // Alert 2: Check if no admin exists
    if (metrics.admin_count === 0) {
      alerts.push({
        type: 'error',
        message: 'No admin users found - this may cause system access issues',
        details: { admin_count: metrics.admin_count },
        timestamp: new Date().toISOString()
      });
    }

    // Alert 3: Check registration patterns
    if (metrics.recent_registrations_24h > 0 && metrics.recent_user_assignments_24h === 0) {
      alerts.push({
        type: 'warning',
        message: 'Recent registrations detected but no users assigned "user" role',
        details: {
          recent_registrations: metrics.recent_registrations_24h,
          recent_user_assignments: metrics.recent_user_assignments_24h
        },
        timestamp: new Date().toISOString()
      });
    }

    // Alert 4: Healthy state confirmation
    if (alerts.length === 0 && metrics.recent_registrations_24h > 0) {
      alerts.push({
        type: 'info',
        message: 'Role assignments appear healthy - recent registrations assigned correct roles',
        details: {
          recent_registrations: metrics.recent_registrations_24h,
          recent_user_assignments: metrics.recent_user_assignments_24h,
          issues_detected: 0
        },
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  /**
   * Get recent user registrations for detailed analysis
   */
  async getRecentRegistrations(hours: number = 24): Promise<any[]> {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data: profiles, error } = await this.supabase
        .from('profiles')
        .select('id, email, name, role, status, created_at')
        .gt('created_at', cutoffTime)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching recent registrations:', error);
        return [];
      }

      return profiles || [];

    } catch (error) {
      console.error('Error getting recent registrations:', error);
      return [];
    }
  }

  /**
   * Generate monitoring report
   */
  async generateMonitoringReport(): Promise<string> {
    const metrics = await this.getRoleMetrics();
    const alerts = await this.checkForIssues();
    const recentRegistrations = await this.getRecentRegistrations(24);

    let report = `\n=== Role Assignment Monitoring Report ===\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    if (metrics) {
      report += `=== Current Metrics ===\n`;
      report += `Total Users: ${metrics.total_users}\n`;
      report += `├─ Admins: ${metrics.admin_count}\n`;
      report += `├─ Managers: ${metrics.manager_count}\n`;
      report += `└─ Users: ${metrics.user_count}\n\n`;

      report += `Recent Activity (24h):\n`;
      report += `├─ New Registrations: ${metrics.recent_registrations_24h}\n`;
      report += `├─ User Role Assignments: ${metrics.recent_user_assignments_24h}\n`;
      report += `└─ Potential Issues: ${metrics.potential_issues}\n\n`;
    }

    report += `=== Alerts (${alerts.length}) ===\n`;
    if (alerts.length === 0) {
      report += `✅ No alerts - system appears healthy\n\n`;
    } else {
      alerts.forEach((alert, index) => {
        const icon = alert.type === 'error' ? '❌' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
        report += `${index + 1}. ${icon} ${alert.message}\n`;
        report += `   Time: ${alert.timestamp}\n`;
        report += `   Details: ${JSON.stringify(alert.details, null, 2)}\n\n`;
      });
    }

    if (recentRegistrations.length > 0) {
      report += `=== Recent Registrations ===\n`;
      recentRegistrations.forEach((user, index) => {
        const roleIcon = user.role === 'admin' ? '👑' : user.role === 'manager' ? '📊' : '👤';
        report += `${index + 1}. ${roleIcon} ${user.email} (${user.role})\n`;
        report += `   Name: ${user.name}\n`;
        report += `   Registered: ${user.created_at}\n\n`;
      });
    }

    report += `=== Recommendations ===\n`;
    const hasErrors = alerts.some(a => a.type === 'error');
    const hasWarnings = alerts.some(a => a.type === 'warning');

    if (hasErrors) {
      report += `🚨 Critical issues detected - immediate attention required\n`;
    } else if (hasWarnings) {
      report += `⚠️  Potential issues detected - investigation recommended\n`;
    } else {
      report += `✅ System appears healthy - continue normal monitoring\n`;
    }

    return report;
  }

  /**
   * Validate database trigger function is working
   */
  async validateTriggerFunction(): Promise<boolean> {
    try {
      // This would require a test registration or database function call
      // For now, we validate by checking recent assignments
      const metrics = await this.getRoleMetrics();
      
      if (!metrics) return false;

      // If there are recent registrations, they should mostly be 'user' role
      const recentUserRatio = metrics.recent_registrations_24h === 0 ? 1 : 
        metrics.recent_user_assignments_24h / metrics.recent_registrations_24h;

      // Consider healthy if 80% or more of recent registrations got 'user' role
      return recentUserRatio >= 0.8;

    } catch (error) {
      console.error('Error validating trigger function:', error);
      return false;
    }
  }
}

// Utility function for scheduled monitoring
export async function scheduleRoleMonitoring() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not configured for monitoring');
    return;
  }

  const monitor = new RoleAssignmentMonitor(supabaseUrl, supabaseKey);
  
  try {
    const report = await monitor.generateMonitoringReport();
    console.log(report);
    
    // Could be extended to send alerts via email, Slack, etc.
    const alerts = await monitor.checkForIssues();
    const criticalAlerts = alerts.filter(a => a.type === 'error');
    
    if (criticalAlerts.length > 0) {
      console.error('🚨 Critical role assignment issues detected!');
      // Send notification logic here
    }

  } catch (error) {
    console.error('Role monitoring failed:', error);
  }
}

export default RoleAssignmentMonitor;
