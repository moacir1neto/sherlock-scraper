import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Users, 
  CheckCircle2, 
  XCircle, 
  TrendingUp,
  Building2,
  Settings,
  Clock,
  Headphones,
  CheckCircle
} from 'lucide-react';
import { instanceService, dashboardService } from '../services/api';
import { StatCardSkeleton } from '../components/LoadingSkeleton';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { companyService } from '../services/company';
import { superAdminService } from '../services/superAdmin';
import { adminService } from '../services/admin';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

interface DashboardStats {
  totalInstances: number;
  connectedInstances: number;
  disconnectedInstances: number;
  messagesToday: number;
  totalCompanies?: number;
  totalUsers?: number;
  chatsAguardando?: number;
  chatsAtendendo?: number;
  chatsFinalizado?: number;
}

export function Dashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any>(null);
  const [statusChartData, setStatusChartData] = useState<any>(null);
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [instances, statsPayload] = await Promise.all([
        instanceService.list(),
        dashboardService.getStats().catch(() => ({
          messages_today: 0,
          messages_last_7_days: [0, 0, 0, 0, 0, 0, 0],
          chats_aguardando: 0,
          chats_atendendo: 0,
          chats_finalizado: 0,
        })),
      ]);

      let filteredInstances = instances;
      if (!isSuperAdmin && user?.company_id) {
        filteredInstances = instances.filter((inst: any) =>
          inst.company_id === user.company_id || inst.instance?.company_id === user.company_id
        );
      }

      const instancesWithStatus = await Promise.all(
        filteredInstances.map(async (instance: any) => {
          try {
            const status = await instanceService.status(instance.instanceName || instance.id);
            return {
              ...instance,
              isConnected: status?.instance?.state === 'open' || status?.status === 'open'
            };
          } catch {
            return { ...instance, isConnected: false };
          }
        })
      );

      const connected = instancesWithStatus.filter((i: any) => i.isConnected).length;
      const disconnected = instancesWithStatus.length - connected;
      const messagesToday = statsPayload?.messages_today ?? 0;
      const messagesLast7Days = Array.isArray(statsPayload?.messages_last_7_days)
        ? statsPayload.messages_last_7_days
        : [0, 0, 0, 0, 0, 0, 0];
      const chatsAguardando = statsPayload?.chats_aguardando ?? 0;
      const chatsAtendendo = statsPayload?.chats_atendendo ?? 0;
      const chatsFinalizado = statsPayload?.chats_finalizado ?? 0;

      // Se for super admin, buscar dados de todo o sistema
      let totalCompanies = undefined;
      let totalUsers = undefined;
      
      if (isSuperAdmin) {
        try {
          const [companiesData, usersData] = await Promise.all([
            companyService.list().catch(() => []),
            superAdminService.listUsers().catch(() => []),
          ]);
          totalCompanies = Array.isArray(companiesData) ? companiesData.length : 0;
          totalUsers = Array.isArray(usersData) ? usersData.length : 0;
        } catch (error) {
          console.error('Erro ao buscar dados do sistema:', error);
        }
      } else if (user?.role === 'admin') {
        // Admin: buscar dados da empresa dele
        try {
          const [companyData, usersData] = await Promise.all([
            adminService.getCompany().catch(() => null),
            adminService.listUsers().catch(() => []),
          ]);
          totalCompanies = companyData ? 1 : 0;
          totalUsers = Array.isArray(usersData) ? usersData.length : 0;
        } catch (error) {
          console.error('Erro ao buscar dados da empresa:', error);
        }
      }

      setStats({
        totalInstances: filteredInstances.length,
        connectedInstances: connected,
        disconnectedInstances: disconnected,
        messagesToday,
        totalCompanies,
        totalUsers,
        chatsAguardando,
        chatsAtendendo,
        chatsFinalizado,
      });

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toLocaleDateString('pt-BR', { weekday: 'short' });
      });

      setChartData({
        labels: last7Days,
        datasets: [
          {
            label: 'Mensagens Enviadas',
            data: messagesLast7Days,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      });

      setStatusChartData({
        labels: ['Aguardando', 'Atendendo', 'Finalizado'],
        datasets: [
          {
            data: [chatsAguardando, chatsAtendendo, chatsFinalizado],
            backgroundColor: [
              'rgba(251, 191, 36, 0.8)',
              'rgba(34, 197, 94, 0.8)',
              'rgba(107, 114, 128, 0.8)',
            ],
            borderColor: ['rgb(251, 191, 36)', 'rgb(34, 197, 94)', 'rgb(107, 114, 128)'],
            borderWidth: 1,
          },
        ],
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = isSuperAdmin
    ? [
        {
          title: 'Total de Empresas',
          value: stats?.totalCompanies ?? 0,
          icon: Building2,
          color: 'text-indigo-600 dark:text-indigo-400',
          bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
        },
        {
          title: 'Total de Usuários',
          value: stats?.totalUsers ?? 0,
          icon: Users,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        },
        {
          title: 'Total de Instâncias',
          value: stats?.totalInstances ?? 0,
          icon: Settings,
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        },
        {
          title: 'Instâncias Conectadas',
          value: stats?.connectedInstances ?? 0,
          icon: CheckCircle2,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
        },
        {
          title: 'Instâncias Desconectadas',
          value: stats?.disconnectedInstances ?? 0,
          icon: XCircle,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
        },
        {
          title: 'Mensagens Hoje',
          value: stats?.messagesToday ?? 0,
          icon: MessageSquare,
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        },
        {
          title: 'Chats Aguardando',
          value: stats?.chatsAguardando ?? 0,
          icon: Clock,
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        },
        {
          title: 'Chats Atendendo',
          value: stats?.chatsAtendendo ?? 0,
          icon: Headphones,
          color: 'text-emerald-600 dark:text-emerald-400',
          bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
        },
        {
          title: 'Chats Finalizados',
          value: stats?.chatsFinalizado ?? 0,
          icon: CheckCircle,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
        },
      ]
    : [
        {
          title: 'Total de Instâncias',
          value: stats?.totalInstances ?? 0,
          icon: Users,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        },
        {
          title: 'Conectadas',
          value: stats?.connectedInstances ?? 0,
          icon: CheckCircle2,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/30',
        },
        {
          title: 'Desconectadas',
          value: stats?.disconnectedInstances ?? 0,
          icon: XCircle,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
        },
        {
          title: 'Mensagens Hoje',
          value: stats?.messagesToday ?? 0,
          icon: MessageSquare,
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        },
        {
          title: 'Chats Aguardando',
          value: stats?.chatsAguardando ?? 0,
          icon: Clock,
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        },
        {
          title: 'Chats Atendendo',
          value: stats?.chatsAtendendo ?? 0,
          icon: Headphones,
          color: 'text-emerald-600 dark:text-emerald-400',
          bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
        },
        {
          title: 'Chats Finalizados',
          value: stats?.chatsFinalizado ?? 0,
          icon: CheckCircle,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
        },
      ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {isSuperAdmin 
            ? 'Visão geral de todo o sistema' 
            : 'Visão geral do seu sistema WhatsApp'}
        </p>
      </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {loading ? (
            Array.from({ length: statCards.length }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          ) : (
            statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                        {stat.value}
                      </p>
                    </div>
                    <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                      <Icon size={24} />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {chartData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Mensagens Enviadas (Últimos 7 dias)
                </h2>
                <TrendingUp className="text-green-600 dark:text-green-400" size={22} />
              </div>
              <div className="h-64">
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: theme === 'dark' ? '#9ca3af' : '#6b7280', maxRotation: 0 },
                      },
                      y: {
                        beginAtZero: true,
                        grid: { color: theme === 'dark' ? '#374151' : '#e5e7eb' },
                        ticks: { color: theme === 'dark' ? '#9ca3af' : '#6b7280' },
                      },
                    },
                  }}
                />
              </div>
            </motion.div>
          )}
          {statusChartData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Chats por Status
                </h2>
                <Headphones className="text-emerald-600 dark:text-emerald-400" size={22} />
              </div>
              <div className="h-64 flex items-center justify-center">
                <Doughnut
                  data={statusChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                        labels: { color: theme === 'dark' ? '#9ca3af' : '#6b7280' },
                      },
                      tooltip: {
                        backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                      },
                    },
                  }}
                />
              </div>
            </motion.div>
          )}
        </div>

    </div>
  );
}


