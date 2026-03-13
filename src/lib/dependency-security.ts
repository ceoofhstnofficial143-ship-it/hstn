// Security Dependency Updates & Vulnerability Scanning
// Automated security monitoring and dependency management

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Security scanning configuration
export const SECURITY_SCAN_CONFIG = {
  // Scan frequency
  scanInterval: 24 * 60 * 60 * 1000, // 24 hours
  lastScan: null as Date | null,

  // Vulnerability severity thresholds
  severityThresholds: {
    critical: 9.0,
    high: 7.0,
    medium: 4.0,
    low: 0.1
  },

  // Dependencies to monitor closely
  criticalDependencies: [
    'next',
    'react',
    'supabase',
    '@supabase/supabase-js',
    'next-pwa'
  ],

  // Excluded vulnerabilities (false positives)
  excludedVulnerabilities: [] as string[]
};

// Vulnerability scan result interface
export interface VulnerabilityScan {
  timestamp: Date;
  dependencies: DependencyInfo[];
  vulnerabilities: Vulnerability[];
  summary: {
    totalDeps: number;
    vulnerableDeps: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  recommendations: string[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  latestVersion?: string;
  isOutdated: boolean;
  vulnerabilities: Vulnerability[];
}

export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore: number;
  affectedVersions: string;
  fixedVersions?: string;
  references: string[];
  publishedDate: Date;
}

// Run npm audit to check for vulnerabilities
export async function runSecurityAudit(): Promise<VulnerabilityScan> {
  try {
    console.log('🔍 Running security audit...');

    // Run npm audit
    const { stdout: auditOutput } = await execAsync('npm audit --json');
    const auditData = JSON.parse(auditOutput);

    // Run npm outdated to check for updates
    const { stdout: outdatedOutput } = await execAsync('npm outdated --json');
    const outdatedData = JSON.parse(outdatedOutput || '{}');

    // Parse vulnerabilities
    const vulnerabilities: Vulnerability[] = [];
    if (auditData.vulnerabilities) {
      for (const [pkgName, vulnData] of Object.entries(auditData.vulnerabilities)) {
        const vuln = vulnData as any;
        vulnerabilities.push({
          id: vuln.id || `${pkgName}-${Date.now()}`,
          title: vuln.title || 'Security vulnerability',
          description: vuln.overview || vuln.recommendation || 'No description available',
          severity: mapSeverity(vuln.severity),
          cvssScore: vuln.cvss?.score || 0,
          affectedVersions: vuln.range || vuln.vulnerableVersions || '*',
          fixedVersions: vuln.fixedIn || vuln.recommendation,
          references: vuln.references || [],
          publishedDate: new Date(vuln.published || Date.now())
        });
      }
    }

    // Parse dependency information
    const dependencies: DependencyInfo[] = [];
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    for (const [name, version] of Object.entries({
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    })) {
      const currentVersion = version as string;
      const latestVersion = outdatedData[name]?.latest;
      const isOutdated = !!latestVersion && latestVersion !== currentVersion.replace('^', '');

      const pkgVulnerabilities = vulnerabilities.filter(v =>
        v.affectedVersions.includes(name) ||
        v.title.toLowerCase().includes(name.toLowerCase())
      );

      dependencies.push({
        name,
        version: currentVersion,
        latestVersion,
        isOutdated,
        vulnerabilities: pkgVulnerabilities
      });
    }

    // Generate summary
    const summary = {
      totalDeps: dependencies.length,
      vulnerableDeps: dependencies.filter(d => d.vulnerabilities.length > 0).length,
      criticalCount: vulnerabilities.filter(v => v.severity === 'critical').length,
      highCount: vulnerabilities.filter(v => v.severity === 'high').length,
      mediumCount: vulnerabilities.filter(v => v.severity === 'medium').length,
      lowCount: vulnerabilities.filter(v => v.severity === 'low').length
    };

    // Generate recommendations
    const recommendations = generateRecommendations(dependencies, vulnerabilities);

    const scanResult: VulnerabilityScan = {
      timestamp: new Date(),
      dependencies,
      vulnerabilities,
      summary,
      recommendations
    };

    SECURITY_SCAN_CONFIG.lastScan = new Date();
    console.log('✅ Security audit completed');

    return scanResult;

  } catch (error) {
    console.error('❌ Security audit failed:', error);
    throw error;
  }
}

// Map npm audit severity to our severity levels
function mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'moderate':
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'low';
  }
}

// Generate security recommendations
function generateRecommendations(
  dependencies: DependencyInfo[],
  vulnerabilities: Vulnerability[]
): string[] {
  const recommendations: string[] = [];

  // Check for outdated critical dependencies
  const outdatedCritical = dependencies.filter(d =>
    d.isOutdated && SECURITY_SCAN_CONFIG.criticalDependencies.includes(d.name)
  );

  if (outdatedCritical.length > 0) {
    recommendations.push(
      `🚨 Update critical dependencies: ${outdatedCritical.map(d => d.name).join(', ')}`
    );
  }

  // Check for high/critical vulnerabilities
  const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
  const highVulns = vulnerabilities.filter(v => v.severity === 'high');

  if (criticalVulns.length > 0) {
    recommendations.push(
      `🚨 Address ${criticalVulns.length} critical security vulnerabilities immediately`
    );
  }

  if (highVulns.length > 0) {
    recommendations.push(
      `⚠️ Address ${highVulns.length} high severity security vulnerabilities`
    );
  }

  // General recommendations
  if (dependencies.some(d => d.isOutdated)) {
    recommendations.push('📦 Update outdated dependencies regularly');
  }

  if (vulnerabilities.length === 0) {
    recommendations.push('✅ No security vulnerabilities found - keep monitoring!');
  }

  return recommendations;
}

// Automated dependency update
export async function updateDependencies(options: {
  updateType: 'patch' | 'minor' | 'major' | 'security';
  dryRun?: boolean;
} = { updateType: 'patch', dryRun: true }): Promise<{
  success: boolean;
  updated: string[];
  failed: string[];
  output: string;
}> {
  try {
    let command = 'npm update';

    // Choose update command based on type
    switch (options.updateType) {
      case 'security':
        command = 'npm audit fix';
        break;
      case 'patch':
        command = 'npm update --save';
        break;
      case 'minor':
        command = 'npm update';
        break;
      case 'major':
        command = 'npm update --save'; // npm won't auto-update major versions
        break;
    }

    if (options.dryRun) {
      command += ' --dry-run';
    }

    console.log(`🔄 ${options.dryRun ? 'Checking' : 'Updating'} dependencies (${options.updateType})...`);

    const { stdout, stderr } = await execAsync(command);

    // Parse output to determine what was updated
    const updated: string[] = [];
    const failed: string[] = [];

    // Basic parsing (would need more sophisticated parsing for real implementation)
    if (stdout.includes('updated')) {
      // Extract updated packages from output
    }

    return {
      success: true,
      updated,
      failed,
      output: stdout + stderr
    };

  } catch (error) {
    console.error('❌ Dependency update failed:', error);
    return {
      success: false,
      updated: [],
      failed: [],
      output: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Check for dependency conflicts
export async function checkDependencyConflicts(): Promise<{
  hasConflicts: boolean;
  conflicts: Array<{
    package: string;
    requiredBy: string[];
    conflictingVersions: string[];
  }>;
}> {
  try {
    const { stdout } = await execAsync('npm ls --depth=0 --json');
    const dependencyTree = JSON.parse(stdout);

    const conflicts: Array<{
      package: string;
      requiredBy: string[];
      conflictingVersions: string[];
    }> = [];

    // Analyze dependency tree for conflicts
    // This is a simplified implementation
    for (const [pkg, info] of Object.entries(dependencyTree.dependencies || {})) {
      const pkgInfo = info as any;
      if (pkgInfo.required && typeof pkgInfo.required === 'object') {
        // Check for version conflicts
        const versions = Object.values(pkgInfo.required);
        const uniqueVersions = [...new Set(versions)];

        if (uniqueVersions.length > 1) {
          conflicts.push({
            package: pkg,
            requiredBy: Object.keys(pkgInfo.required),
            conflictingVersions: uniqueVersions as string[]
          });
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };

  } catch (error) {
    console.error('❌ Dependency conflict check failed:', error);
    return {
      hasConflicts: false,
      conflicts: []
    };
  }
}

// Generate security report
export async function generateSecurityReport(): Promise<string> {
  try {
    const scanResult = await runSecurityAudit();
    const conflicts = await checkDependencyConflicts();

    let report = `# 🔒 Security Report - ${new Date().toISOString()}\n\n`;

    // Summary
    report += `## 📊 Summary\n`;
    report += `- **Total Dependencies:** ${scanResult.summary.totalDeps}\n`;
    report += `- **Vulnerable Dependencies:** ${scanResult.summary.vulnerableDeps}\n`;
    report += `- **Critical Vulnerabilities:** ${scanResult.summary.criticalCount}\n`;
    report += `- **High Vulnerabilities:** ${scanResult.summary.highCount}\n`;
    report += `- **Medium Vulnerabilities:** ${scanResult.summary.mediumCount}\n`;
    report += `- **Low Vulnerabilities:** ${scanResult.summary.lowCount}\n`;
    report += `- **Dependency Conflicts:** ${conflicts.hasConflicts ? 'Yes' : 'No'}\n\n`;

    // Vulnerabilities
    if (scanResult.vulnerabilities.length > 0) {
      report += `## 🚨 Vulnerabilities\n`;
      for (const vuln of scanResult.vulnerabilities) {
        report += `### ${vuln.severity.toUpperCase()}: ${vuln.title}\n`;
        report += `- **Package:** ${vuln.affectedVersions}\n`;
        report += `- **CVSS Score:** ${vuln.cvssScore}\n`;
        report += `- **Description:** ${vuln.description}\n`;
        if (vuln.fixedVersions) {
          report += `- **Fixed in:** ${vuln.fixedVersions}\n`;
        }
        report += `\n`;
      }
    }

    // Outdated dependencies
    const outdated = scanResult.dependencies.filter(d => d.isOutdated);
    if (outdated.length > 0) {
      report += `## 📦 Outdated Dependencies\n`;
      for (const dep of outdated) {
        report += `- **${dep.name}:** ${dep.version} → ${dep.latestVersion}\n`;
      }
      report += `\n`;
    }

    // Recommendations
    if (scanResult.recommendations.length > 0) {
      report += `## 💡 Recommendations\n`;
      for (const rec of scanResult.recommendations) {
        report += `- ${rec}\n`;
      }
    }

    return report;

  } catch (error) {
    return `# ❌ Security Report Generation Failed\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Schedule automated security scans
export function scheduleSecurityScans(): void {
  // Run initial scan
  runSecurityAudit().then(result => {
    console.log('🔍 Initial security scan completed');
    console.log(`📊 Found ${result.summary.vulnerableDeps} vulnerable dependencies`);
  }).catch(error => {
    console.error('❌ Initial security scan failed:', error);
  });

  // Schedule recurring scans
  setInterval(async () => {
    try {
      const result = await runSecurityAudit();
      console.log(`🔍 Security scan completed: ${result.summary.vulnerableDeps} vulnerabilities found`);

      // Alert if critical vulnerabilities found
      if (result.summary.criticalCount > 0) {
        console.error(`🚨 CRITICAL: ${result.summary.criticalCount} critical vulnerabilities detected!`);
      }
    } catch (error) {
      console.error('❌ Scheduled security scan failed:', error);
    }
  }, SECURITY_SCAN_CONFIG.scanInterval);
}

// Export functions for use in scripts
export const securityMaintenance = {
  runAudit: runSecurityAudit,
  updateDeps: updateDependencies,
  checkConflicts: checkDependencyConflicts,
  generateReport: generateSecurityReport,
  scheduleScans: scheduleSecurityScans
};
