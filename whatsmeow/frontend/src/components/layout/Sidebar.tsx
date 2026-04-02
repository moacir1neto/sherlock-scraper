import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  Users,
  Building2,
  ChevronRight,
  LucideIcon,
  MessageCircle,
  Activity,
  AlertCircle,
  FileSearch,
  Webhook,
  ListChecks,
  Book,
  Tag,
  MessageSquare,
  Calendar,
  Columns,
  GitBranch,
  Search,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  icon: LucideIcon;
  path: string;
  roles?: string[];
  children?: MenuItem[];
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Expand Monitoramento when on incidentes/auditoria
  useEffect(() => {
    if (location.pathname.startsWith('/super-admin/monitoramento')) {
      setExpandedItems((prev) => (prev.includes('/super-admin/monitoramento') ? prev : [...prev, '/super-admin/monitoramento']));
    }
  }, [location.pathname]);

  // Build menu items dynamically based on user role
  const menuItems: MenuItem[] = [];

  // Super Admin: mostra diretamente os itens do menu (sem menu expansível)
  if (user?.role === 'super_admin') {
    menuItems.push(
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard',
        roles: ['super_admin'],
      },
      {
        label: 'Empresas',
        icon: Building2,
        path: '/super-admin/companies',
        roles: ['super_admin'],
      },
      {
        label: 'Usuários',
        icon: Users,
        path: '/super-admin/users',
        roles: ['super_admin'],
      },
      {
        label: 'Instâncias',
        icon: Settings,
        path: '/super-admin/instances',
        roles: ['super_admin'],
      },
      {
        label: 'Chat',
        icon: MessageCircle,
        path: '/chat',
        roles: ['super_admin'],
      },
      {
        label: 'Monitoramento',
        icon: Activity,
        path: '/super-admin/monitoramento',
        roles: ['super_admin'],
        children: [
          { label: 'Incidentes', path: '/super-admin/monitoramento/incidentes', icon: AlertCircle },
          { label: 'Auditoria', path: '/super-admin/monitoramento/auditoria', icon: FileSearch },
        ],
      },
      {
        label: 'Webhook',
        icon: Webhook,
        path: '/admin/webhook',
        roles: ['super_admin'],
      },
      {
        label: 'Logs Webhook',
        icon: ListChecks,
        path: '/admin/webhook-logs',
        roles: ['super_admin'],
      },
      {
        label: 'API',
        icon: Book,
        path: '/admin/api',
        roles: ['super_admin'],
      },
      {
        label: 'Setores',
        icon: Building2,
        path: '/admin/sectors',
        roles: ['super_admin'],
      },
      {
        label: 'Tags',
        icon: Tag,
        path: '/admin/tags',
        roles: ['super_admin'],
      },
      {
        label: 'Configurações',
        icon: SlidersHorizontal,
        path: '/admin/settings',
        roles: ['super_admin'],
      },
      { label: 'Respostas Rápidas', icon: MessageSquare, path: '/admin/quick-replies', roles: ['super_admin'] },
      { label: 'Agendamentos', icon: Calendar, path: '/admin/scheduling', roles: ['super_admin'] },
      { label: 'Kanban', icon: Columns, path: '/admin/kanban', roles: ['super_admin'] },
      { label: 'Fluxos', icon: GitBranch, path: '/admin/flows', roles: ['super_admin'] },
      { label: 'Prospecção', icon: Search, path: '/admin/sherlock', roles: ['super_admin'] },
      { label: 'Leads', icon: Users, path: '/admin/leads', roles: ['super_admin'] }
    );
  }
  // Admin: mostra diretamente os itens do menu (sem menu expansível)
  else if (user?.role === 'admin') {
    menuItems.push(
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard',
        roles: ['admin'],
      },
      {
        label: 'Instâncias',
        icon: Settings,
        path: '/instances',
        roles: ['admin'],
      },
      {
        label: 'Chat',
        icon: MessageCircle,
        path: '/chat',
        roles: ['admin'],
      },
      {
        label: 'Usuários',
        icon: Users,
        path: '/admin/users',
        roles: ['admin'],
      },
      {
        label: 'Perfil da Empresa',
        icon: Building2,
        path: '/admin/company',
        roles: ['admin'],
      },
      {
        label: 'Webhook',
        icon: Webhook,
        path: '/admin/webhook',
        roles: ['admin'],
      },
      {
        label: 'Logs Webhook',
        icon: ListChecks,
        path: '/admin/webhook-logs',
        roles: ['admin'],
      },
      {
        label: 'API',
        icon: Book,
        path: '/admin/api',
        roles: ['admin'],
      },
      {
        label: 'Setores',
        icon: Building2,
        path: '/admin/sectors',
        roles: ['admin'],
      },
      {
        label: 'Tags',
        icon: Tag,
        path: '/admin/tags',
        roles: ['admin'],
      },
      {
        label: 'Configurações',
        icon: SlidersHorizontal,
        path: '/admin/settings',
        roles: ['admin'],
      },
      { label: 'Respostas Rápidas', icon: MessageSquare, path: '/admin/quick-replies', roles: ['admin'] },
      { label: 'Agendamentos', icon: Calendar, path: '/admin/scheduling', roles: ['admin'] },
      { label: 'Kanban', icon: Columns, path: '/admin/kanban', roles: ['admin'] },
      { label: 'Fluxos', icon: GitBranch, path: '/admin/flows', roles: ['admin'] },
      { label: 'Prospecção', icon: Search, path: '/admin/sherlock', roles: ['admin'] },
      { label: 'Leads', icon: Users, path: '/admin/leads', roles: ['admin'] }
    );
  }
  // User: mostra apenas menu geral
  else {
    menuItems.push(
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard',
        roles: ['user'],
      },
      {
        label: 'Instâncias',
        icon: Settings,
        path: '/instances',
        roles: ['user'],
      },
      {
        label: 'Chat',
        icon: MessageCircle,
        path: '/chat',
        roles: ['user'],
      },
      {
        label: 'Tags',
        icon: Tag,
        path: '/admin/tags',
        roles: ['user'],
      },
      {
        label: 'Configurações',
        icon: SlidersHorizontal,
        path: '/admin/settings',
        roles: ['user'],
      }
    );
  }

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || '');
  });

  const toggleExpanded = (path: string) => {
    setExpandedItems((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const isActive = (path: string) => {
    // Para /super-admin, verificar se está na rota /super-admin (mas não é dashboard ou instâncias)
    if (path === '/super-admin') {
      return location.pathname.startsWith('/super-admin') && 
             location.pathname !== '/dashboard' && 
             location.pathname !== '/instances';
    }
    // Monitoramento (incidentes / auditoria)
    if (path === '/super-admin/monitoramento') {
      return location.pathname.startsWith('/super-admin/monitoramento');
    }
    // Para rotas específicas do admin
    if (path === '/admin/flows') {
      return location.pathname.startsWith('/admin/flows');
    }
    if (path === '/admin/users' || path === '/admin/company' || path === '/admin/webhook' || path === '/admin/webhook-logs' || path === '/admin/api' || path === '/admin/tags' || path === '/admin/sectors' || path === '/admin/settings' || path === '/admin/quick-replies' || path === '/admin/scheduling' || path === '/admin/kanban') {
      return location.pathname === path;
    }
    if (path === '/chat') {
      return location.pathname === '/chat';
    }
    return location.pathname === path;
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64 overflow-y-auto shadow-sm`}
      >
        {/* Menu Items */}
        <nav className="p-4">
          <div className="space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems.includes(item.path);
              const itemActive = isActive(item.path);

              if (hasChildren) {
                return (
                  <div key={item.path}>
                    <button
                      onClick={() => toggleExpanded(item.path)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                        itemActive
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children?.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = isActive(child.path);
                          return (
                            <button
                              key={child.path}
                              onClick={() => handleNavigation(child.path)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                childActive
                                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <ChildIcon size={16} />
                              <span className="text-sm">{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    itemActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

      </aside>
    </>
  );
}

