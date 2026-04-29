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
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
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
          gradient: 'from-green-500 to-blue-600',
          ariaLabel: 'Total de empresas cadastradas no sistema',
        },
        {
          title: 'Total de Usuários',
          value: stats?.totalUsers ?? 0,
          icon: Users,
          gradient: 'from-blue-500 to-cyan-600',
          ariaLabel: 'Total de usuários ativos no sistema',
        },
        {
          title: 'Total de Instâncias',
          value: stats?.totalInstances ?? 0,
          icon: Settings,
          gradient: 'from-emerald-500 to-green-600',
          ariaLabel: 'Número total de instâncias de WhatsApp',
        },
        {
          title: 'Instâncias Conectadas',
          value: stats?.connectedInstances ?? 0,
          icon: CheckCircle2,
          gradient: 'from-emerald-500 to-teal-600',
          ariaLabel: 'Instâncias com conexão ativa',
        },
        {
          title: 'Instâncias Desconectadas',
          value: stats?.disconnectedInstances ?? 0,
          icon: XCircle,
          gradient: 'from-rose-500 to-red-600',
          ariaLabel: 'Instâncias que precisam de reconexão',
        },
        {
          title: 'Mensagens Hoje',
          value: stats?.messagesToday ?? 0,
          icon: MessageSquare,
          gradient: 'from-amber-500 to-orange-600',
          ariaLabel: 'Total de mensagens enviadas nas últimas 24 horas',
        },
        {
          title: 'Chats Aguardando',
          value: stats?.chatsAguardando ?? 0,
          icon: Clock,
          gradient: 'from-amber-400 to-amber-600',
          ariaLabel: 'Conversas pendentes de atendimento',
        },
        {
          title: 'Chats Atendendo',
          value: stats?.chatsAtendendo ?? 0,
          icon: Headphones,
          gradient: 'from-primary-500 to-primary-700',
          ariaLabel: 'Conversas em atendimento ativo',
        },
        {
          title: 'Chats Finalizados',
          value: stats?.chatsFinalizado ?? 0,
          icon: CheckCircle,
          gradient: 'from-slate-500 to-slate-700',
          ariaLabel: 'Conversas encerradas hoje',
        },
      ]
    : [
        {
          title: 'Total de Instâncias',
          value: stats?.totalInstances ?? 0,
          icon: Users,
          gradient: 'from-emerald-500 to-green-600',
          ariaLabel: 'Número total de instâncias vinculadas',
        },
        {
          title: 'Conectadas',
          value: stats?.connectedInstances ?? 0,
          icon: CheckCircle2,
          gradient: 'from-emerald-500 to-teal-600',
          ariaLabel: 'Instâncias conectadas',
        },
        {
          title: 'Desconectadas',
          value: stats?.disconnectedInstances ?? 0,
          icon: XCircle,
          gradient: 'from-rose-500 to-red-600',
          ariaLabel: 'Instâncias desconectadas',
        },
        {
          title: 'Mensagens Hoje',
          value: stats?.messagesToday ?? 0,
          icon: MessageSquare,
          gradient: 'from-amber-500 to-orange-600',
          ariaLabel: 'Mensagens enviadas hoje',
        },
        {
          title: 'Chats Aguardando',
          value: stats?.chatsAguardando ?? 0,
          icon: Clock,
          gradient: 'from-amber-400 to-amber-600',
          ariaLabel: 'Atendimentos pendentes',
        },
        {
          title: 'Chats Atendendo',
          value: stats?.chatsAtendendo ?? 0,
          icon: Headphones,
          gradient: 'from-primary-500 to-primary-700',
          ariaLabel: 'Atendimentos em curso',
        },
        {
          title: 'Chats Finalizados',
          value: stats?.chatsFinalizado ?? 0,
          icon: CheckCircle,
          gradient: 'from-slate-500 to-slate-700',
          ariaLabel: 'Atendimentos encerrados',
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {loading ? (
            Array.from({ length: statCards.length }).map((_, i) => (
              <div key={i} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg p-5 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/4"></div>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl"></div>
                </div>
              </div>
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
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-none p-5 hover:shadow-xl hover:border-gray-300/80 transition-all duration-300"
                  aria-label={stat.ariaLabel}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white mt-1.5" aria-label={`${stat.value} ${stat.title}`}>
                        {stat.value}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1 font-medium">
                        <TrendingUp size={10} className="text-emerald-500" />
                        Atualizado agora
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg shadow-gray-200/50 dark:shadow-none shrink-0`}>
                      <Icon size={22} className="text-white" />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {chartData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Desempenho de Mensagens
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Fluxo de disparos nos últimos 7 dias</p>
                </div>
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                  <TrendingUp className="text-emerald-600 dark:text-emerald-400" size={20} />
                </div>
              </div>
              <div className="h-72" aria-label="Gráfico de linha mostrando o volume de mensagens enviadas nos últimos 7 dias">
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
                        backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: theme === 'dark' ? '#fff' : '#111827',
                        bodyColor: theme === 'dark' ? '#d1d5db' : '#374151',
                        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 12,
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: theme === 'dark' ? '#9ca3af' : '#6b7280', font: { size: 11, weight: 500 } },
                      },
                      y: {
                        beginAtZero: true,
                        grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                        ticks: { color: theme === 'dark' ? '#9ca3af' : '#6b7280', font: { size: 11 } },
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
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Distribuição de Atendimentos
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Status atual da fila de chat</p>
                </div>
                <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                  <Headphones className="text-primary-600 dark:text-primary-400" size={20} />
                </div>
              </div>
              <div className="h-72 flex items-center justify-center" aria-label="Gráfico de rosca mostrando a distribuição de chats por status (aguardando, atendendo, finalizado)">
                <Doughnut
                  data={statusChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                        labels: { 
                          color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                          padding: 20,
                          font: { size: 12, weight: 500 },
                          usePointStyle: true,
                          pointStyle: 'circle'
                        },
                      },
                      tooltip: {
                        backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: theme === 'dark' ? '#fff' : '#111827',
                        bodyColor: theme === 'dark' ? '#d1d5db' : '#374151',
                        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 12,
                      },
                    },
                    cutout: '70%',
                  }}
                />
              </div>
            </motion.div>
          )}
        </div>

    </div>
  );
}


