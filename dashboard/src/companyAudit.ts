export type CompanyAuditEvent = {
  id: string;
  time: number;
  actor: string;
  action: string;
  detail: string;
  outcome: string;
  requestId?: string;
};

export const COMPANY_DEMO_KEY = 'guardsaab-northstar-demo-v1';
const LEGACY_COMPANY_KEY = 'warden-northstar-demo-v1';
export type CompanyRequestRecord = { id: string; employeeId: string; amount: number; purpose: string; status: 'PENDING_HR' | 'PENDING_CEO' | 'APPROVED' | 'REJECTED'; createdAt: number; kind?: 'FUND_TRANSFER' | 'QUOTA_INCREASE'; approvalBy?: string; transactionId?: string };
export type CompanyEmployeeRecord = { id: string; name: string; fundsRemaining: number; fundQuota?: number; account: string; manager?: string; department?: string };
export type CompanyDemoRecord = { employees: CompanyEmployeeRecord[]; requests: CompanyRequestRecord[]; ledger: { id: string; employeeId: string; amount: number; purpose: string; time: number; requestId: string }[]; events: CompanyAuditEvent[] };

export function readCompanyDemo(): CompanyDemoRecord | null {
  try {
    const stored = localStorage.getItem(COMPANY_DEMO_KEY) ?? localStorage.getItem(LEGACY_COMPANY_KEY);
    if (stored && !localStorage.getItem(COMPANY_DEMO_KEY)) localStorage.setItem(COMPANY_DEMO_KEY, stored);
    const parsed = JSON.parse(stored ?? 'null') as CompanyDemoRecord | null;
    return parsed && Array.isArray(parsed.employees) && Array.isArray(parsed.requests) && Array.isArray(parsed.ledger) && Array.isArray(parsed.events) ? parsed : null;
  } catch { return null; }
}

export function readCompanyAudit(): CompanyAuditEvent[] {
  try {
    const stored = localStorage.getItem(COMPANY_DEMO_KEY) ?? localStorage.getItem(LEGACY_COMPANY_KEY);
    const parsed = JSON.parse(stored ?? 'null') as { events?: CompanyAuditEvent[] } | null;
    return Array.isArray(parsed?.events) ? parsed.events.filter((event) => event && typeof event.action === 'string' && typeof event.time === 'number') : [];
  } catch {
    return [];
  }
}

export function resolveCompanyRequest(requestId: string, role: 'HR' | 'CEO', approve: boolean, source: CompanyDemoRecord | null = readCompanyDemo()): CompanyDemoRecord | null {
  const state = source ? structuredClone(source) : null;
  if (!state) return null;
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || !request.status.startsWith('PENDING') || (request.status === 'PENDING_CEO' && role !== 'CEO')) return state;
  const employee = state.employees.find((item) => item.id === request.employeeId);
  if (!employee) return state;
  if (role === 'HR' && employee.manager !== 'Nikhil Rao' && employee.department !== 'People') return state;
  const now = Date.now();
  const transactionId = approve ? `NSTAR-${now.toString(36).toUpperCase()}` : undefined;
  const status = approve ? 'APPROVED' : 'REJECTED';
  state.requests = state.requests.map((item) => item.id === requestId ? { ...item, status, approvalBy: role, ...(transactionId ? { transactionId } : {}) } : item);
  if (approve) {
    state.employees = state.employees.map((item) => {
      if (item.id !== employee.id) return item;
      return request.kind === 'QUOTA_INCREASE'
        ? { ...item, fundsRemaining: item.fundsRemaining + request.amount, fundQuota: (item.fundQuota ?? item.fundsRemaining) + request.amount }
        : { ...item, fundsRemaining: Math.max(0, item.fundsRemaining - request.amount) };
    });
    if (request.kind !== 'QUOTA_INCREASE') state.ledger.unshift({ id: transactionId!, employeeId: employee.id, amount: request.amount, purpose: request.purpose, time: now, requestId });
  }
  state.events.unshift({ id: `evt-${now.toString(36)}`, time: now, actor: `${role} · ${role === 'HR' ? 'Nikhil Rao' : 'Ananya Menon'}`, action: approve ? (request.kind === 'QUOTA_INCREASE' ? 'Additional fund quota approved' : 'Approval granted · account credit released') : 'Request rejected · credit prevented', detail: `${request.amount.toLocaleString('en-IN')} INR for ${employee.name}${request.kind === 'QUOTA_INCREASE' ? ' · available quota increased' : transactionId ? ` · ${transactionId}` : ''}`, outcome: approve ? 'APPROVED' : 'REJECTED', requestId });
  localStorage.setItem(COMPANY_DEMO_KEY, JSON.stringify(state));
  return state;
}
