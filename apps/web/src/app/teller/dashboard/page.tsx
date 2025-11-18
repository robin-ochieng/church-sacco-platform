import { getBankTodayIso } from '@/lib/date';
import { DashboardWidget } from './dashboard-widget';

export const dynamic = 'force-dynamic';

export default async function TellerDashboardPage() {
  const today = getBankTodayIso();
  return <DashboardWidget initialDate={today} />;
}
