import {
  Dashboard,
  GraphWidget,
  Metric,
  TextWidget,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

const NAMESPACE = 'ResidentialCRM';
const REGION = 'us-east-2';

function crmMetric(metricName: string, statistic = 'Sum'): Metric {
  return new Metric({
    namespace: NAMESPACE,
    metricName,
    statistic,
    region: REGION,
    dimensionsMap: {
      service: 'ResidentialCRM',
    },
  });
}

export function createDashboard(scope: Construct, id: string): Dashboard {
  const dashboard = new Dashboard(scope, id, {
    dashboardName: 'ResidentialCRM-Operations',
    defaultInterval: Duration.hours(24),
  });

  dashboard.addWidgets(
    new TextWidget({
      markdown: '# Residential CRM - Operational Dashboard',
      width: 24,
      height: 1,
    }),
  );

  dashboard.addWidgets(
    new GraphWidget({
      title: 'Webhooks Processed',
      left: [crmMetric('WebhookProcessed')],
      width: 8,
      height: 6,
    }),
    new GraphWidget({
      title: 'Webhooks Failed',
      left: [crmMetric('WebhookFailed')],
      width: 8,
      height: 6,
    }),
    new GraphWidget({
      title: 'Processing Duration (ms)',
      left: [
        crmMetric('ProcessingDuration', 'Average'),
        crmMetric('ProcessingDuration', 'p99'),
      ],
      width: 8,
      height: 6,
    }),
  );

  dashboard.addWidgets(
    new GraphWidget({
      title: 'Notifications Generated',
      left: [crmMetric('NotificationGenerated')],
      width: 12,
      height: 6,
    }),
    new GraphWidget({
      title: 'Criteria Matched',
      left: [crmMetric('CriteriaMatched')],
      width: 12,
      height: 6,
    }),
  );

  return dashboard;
}
