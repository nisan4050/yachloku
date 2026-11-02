import { serverFetch } from '@/api/server';

export const getAdminOverview = () => serverFetch('/admin/overview');
export const getAdminFeedback = () => serverFetch('/admin/feedback');
