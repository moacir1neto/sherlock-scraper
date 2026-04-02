package services

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/verbeux-ai/whatsmiau/env"
	"go.uber.org/zap"
)

func RunMigrations() error {
	db, err := sql.Open(env.Env.DBDialect, env.Env.DBURL)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Create companies table
	companiesTable := `
	CREATE TABLE IF NOT EXISTS companies (
		id VARCHAR(36) PRIMARY KEY,
		nome VARCHAR(255) NOT NULL,
		cnpj VARCHAR(18) UNIQUE NOT NULL,
		email VARCHAR(255) NOT NULL,
		telefone VARCHAR(20),
		endereco TEXT,
		ativo BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`

	if env.Env.DBDialect == "postgres" {
		companiesTable = `
		CREATE TABLE IF NOT EXISTS companies (
			id VARCHAR(36) PRIMARY KEY,
			nome VARCHAR(255) NOT NULL,
			cnpj VARCHAR(18) UNIQUE NOT NULL,
			email VARCHAR(255) NOT NULL,
			telefone VARCHAR(20),
			endereco TEXT,
			ativo BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		`
	}

	if _, err := db.Exec(companiesTable); err != nil {
		return fmt.Errorf("failed to create companies table: %w", err)
	}

	// Create users table
	usersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id VARCHAR(36) PRIMARY KEY,
		nome VARCHAR(255) NOT NULL,
		email VARCHAR(255) UNIQUE NOT NULL,
		senha VARCHAR(255) NOT NULL,
		role VARCHAR(20) NOT NULL DEFAULT 'user',
		company_id VARCHAR(36),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
	);
	`

	if env.Env.DBDialect == "postgres" {
		usersTable = `
		CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(36) PRIMARY KEY,
			nome VARCHAR(255) NOT NULL,
			email VARCHAR(255) UNIQUE NOT NULL,
			senha VARCHAR(255) NOT NULL,
			role VARCHAR(20) NOT NULL DEFAULT 'user',
			company_id VARCHAR(36),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
		);
		`
	}

	if _, err := db.Exec(usersTable); err != nil {
		return fmt.Errorf("failed to create users table: %w", err)
	}

	// Create chats table (for WhatsApp Web-style chat UI)
	chatsTable := `
	CREATE TABLE IF NOT EXISTS chats (
		id VARCHAR(36) PRIMARY KEY,
		instance_id VARCHAR(255) NOT NULL,
		remote_jid VARCHAR(255) NOT NULL,
		name VARCHAR(255) NOT NULL DEFAULT '',
		last_message_at TIMESTAMP,
		last_message_preview TEXT,
		sector_id VARCHAR(36),
		status VARCHAR(32) NOT NULL DEFAULT 'aguardando',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(instance_id, remote_jid)
	);
	CREATE INDEX IF NOT EXISTS idx_chats_instance_last ON chats(instance_id, last_message_at DESC);
	`
	if env.Env.DBDialect == "postgres" {
		chatsTable = `
		CREATE TABLE IF NOT EXISTS chats (
			id VARCHAR(36) PRIMARY KEY,
			instance_id VARCHAR(255) NOT NULL,
			remote_jid VARCHAR(255) NOT NULL,
			name VARCHAR(255) NOT NULL DEFAULT '',
			last_message_at TIMESTAMP,
			last_message_preview TEXT,
			sector_id VARCHAR(36),
			status VARCHAR(32) NOT NULL DEFAULT 'aguardando',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(instance_id, remote_jid)
		);
		CREATE INDEX IF NOT EXISTS idx_chats_instance_last ON chats(instance_id, last_message_at DESC);
		`
	}
	if _, err := db.Exec(chatsTable); err != nil {
		return fmt.Errorf("failed to create chats table: %w", err)
	}

	// Create messages table
	messagesTable := `
	CREATE TABLE IF NOT EXISTS messages (
		id VARCHAR(36) PRIMARY KEY,
		chat_id VARCHAR(36) NOT NULL,
		wa_message_id VARCHAR(255) NOT NULL,
		from_me BOOLEAN NOT NULL DEFAULT 0,
		message_type VARCHAR(64) NOT NULL DEFAULT 'conversation',
		content TEXT,
		media_url VARCHAR(1024),
		status VARCHAR(32) NOT NULL DEFAULT 'sent',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
		UNIQUE(chat_id, wa_message_id)
	);
	CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC);
	`
	if env.Env.DBDialect == "postgres" {
		messagesTable = `
		CREATE TABLE IF NOT EXISTS messages (
			id VARCHAR(36) PRIMARY KEY,
			chat_id VARCHAR(36) NOT NULL,
			wa_message_id VARCHAR(255) NOT NULL,
			from_me BOOLEAN NOT NULL DEFAULT FALSE,
			message_type VARCHAR(64) NOT NULL DEFAULT 'conversation',
			content TEXT,
			media_url VARCHAR(1024),
			status VARCHAR(32) NOT NULL DEFAULT 'sent',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
			UNIQUE(chat_id, wa_message_id)
		);
		CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC);
		`
	}
	if _, err := db.Exec(messagesTable); err != nil {
		return fmt.Errorf("failed to create messages table: %w", err)
	}

	// Create incidents table (monitoramento / suporte)
	incidentsTable := `
	CREATE TABLE IF NOT EXISTS incidents (
		id VARCHAR(36) PRIMARY KEY,
		tenant_id VARCHAR(36),
		company_id VARCHAR(36),
		user_id VARCHAR(36),
		instance_id VARCHAR(255),
		code VARCHAR(64) NOT NULL,
		message TEXT NOT NULL,
		context_type VARCHAR(64),
		context_id VARCHAR(255),
		request_path VARCHAR(512),
		request_method VARCHAR(16),
		payload_json TEXT,
		error_detail TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_incidents_code ON incidents(code, created_at DESC);
	`
	if env.Env.DBDialect == "postgres" {
		incidentsTable = `
		CREATE TABLE IF NOT EXISTS incidents (
			id VARCHAR(36) PRIMARY KEY,
			tenant_id VARCHAR(36),
			company_id VARCHAR(36),
			user_id VARCHAR(36),
			instance_id VARCHAR(255),
			code VARCHAR(64) NOT NULL,
			message TEXT NOT NULL,
			context_type VARCHAR(64),
			context_id VARCHAR(255),
			request_path VARCHAR(512),
			request_method VARCHAR(16),
			payload_json TEXT,
			error_detail TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_incidents_code ON incidents(code, created_at DESC);
		`
	}
	if _, err := db.Exec(incidentsTable); err != nil {
		return fmt.Errorf("failed to create incidents table: %w", err)
	}

	// Create webhook_logs table (delivery logs for outbound webhooks and inbox)
	webhookLogsTable := `
	CREATE TABLE IF NOT EXISTS webhook_logs (
		id VARCHAR(36) PRIMARY KEY,
		instance_id VARCHAR(255) NOT NULL,
		company_id VARCHAR(36),
		event_type VARCHAR(64) NOT NULL,
		url VARCHAR(2048) NOT NULL DEFAULT '',
		request_body TEXT,
		response_status INTEGER,
		response_body TEXT,
		error_message TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_webhook_logs_instance ON webhook_logs(instance_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_webhook_logs_company ON webhook_logs(company_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);
	`
	if env.Env.DBDialect == "postgres" {
		webhookLogsTable = `
		CREATE TABLE IF NOT EXISTS webhook_logs (
			id VARCHAR(36) PRIMARY KEY,
			instance_id VARCHAR(255) NOT NULL,
			company_id VARCHAR(36),
			event_type VARCHAR(64) NOT NULL,
			url VARCHAR(2048) NOT NULL DEFAULT '',
			request_body TEXT,
			response_status INTEGER,
			response_body TEXT,
			error_message TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_webhook_logs_instance ON webhook_logs(instance_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_webhook_logs_company ON webhook_logs(company_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);
		`
	}
	if _, err := db.Exec(webhookLogsTable); err != nil {
		return fmt.Errorf("failed to create webhook_logs table: %w", err)
	}

	// Tags (por empresa/tenant)
	tagsTable := `
	CREATE TABLE IF NOT EXISTS tags (
		id VARCHAR(36) PRIMARY KEY,
		company_id VARCHAR(36) NOT NULL,
		name VARCHAR(128) NOT NULL,
		color VARCHAR(32) DEFAULT '',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(company_id, name)
	);
	CREATE INDEX IF NOT EXISTS idx_tags_company ON tags(company_id);
	`
	if env.Env.DBDialect == "postgres" {
		tagsTable = `
		CREATE TABLE IF NOT EXISTS tags (
			id VARCHAR(36) PRIMARY KEY,
			company_id VARCHAR(36) NOT NULL,
			name VARCHAR(128) NOT NULL,
			color VARCHAR(32) DEFAULT '',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(company_id, name)
		);
		CREATE INDEX IF NOT EXISTS idx_tags_company ON tags(company_id);
		`
	}
	if _, err := db.Exec(tagsTable); err != nil {
		return fmt.Errorf("failed to create tags table: %w", err)
	}

	// Tags: colunas opcionais para Kanban e ordem (migration para DBs existentes)
	addTagKanbanOrder := func(col string, def string) {
		q := fmt.Sprintf("ALTER TABLE tags ADD COLUMN %s %s", col, def)
		if _, err := db.Exec(q); err != nil {
			if !strings.Contains(err.Error(), "already exists") && !strings.Contains(err.Error(), "duplicate column") {
				zap.L().Warn("tags migration: add column", zap.String("col", col), zap.Error(err))
			}
		}
	}
	if env.Env.DBDialect == "postgres" {
		addTagKanbanOrder("kanban_enabled", "BOOLEAN DEFAULT false")
		addTagKanbanOrder("sort_order", "INTEGER DEFAULT 0")
	} else {
		addTagKanbanOrder("kanban_enabled", "INTEGER DEFAULT 0")
		addTagKanbanOrder("sort_order", "INTEGER DEFAULT 0")
	}

	// Chat-Tag (conversas com tags)
	chatTagsTable := `
	CREATE TABLE IF NOT EXISTS chat_tags (
		chat_id VARCHAR(36) NOT NULL,
		tag_id VARCHAR(36) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (chat_id, tag_id),
		FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
		FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_chat_tags_tag ON chat_tags(tag_id);
	`
	if env.Env.DBDialect == "postgres" {
		chatTagsTable = `
		CREATE TABLE IF NOT EXISTS chat_tags (
			chat_id VARCHAR(36) NOT NULL,
			tag_id VARCHAR(36) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (chat_id, tag_id),
			FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
			FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_chat_tags_tag ON chat_tags(tag_id);
		`
	}
	if _, err := db.Exec(chatTagsTable); err != nil {
		return fmt.Errorf("failed to create chat_tags table: %w", err)
	}

	// Audit log (auditoria)
	auditLogsTable := `
	CREATE TABLE IF NOT EXISTS audit_logs (
		id VARCHAR(36) PRIMARY KEY,
		company_id VARCHAR(36),
		user_id VARCHAR(36),
		user_email VARCHAR(255) DEFAULT '',
		action VARCHAR(64) NOT NULL,
		entity_type VARCHAR(64) NOT NULL,
		entity_id VARCHAR(255),
		old_value TEXT,
		new_value TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
	`
	if env.Env.DBDialect == "postgres" {
		auditLogsTable = `
		CREATE TABLE IF NOT EXISTS audit_logs (
			id VARCHAR(36) PRIMARY KEY,
			company_id VARCHAR(36),
			user_id VARCHAR(36),
			user_email VARCHAR(255) DEFAULT '',
			action VARCHAR(64) NOT NULL,
			entity_type VARCHAR(64) NOT NULL,
			entity_id VARCHAR(255),
			old_value TEXT,
			new_value TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
		`
	}
	if _, err := db.Exec(auditLogsTable); err != nil {
		return fmt.Errorf("failed to create audit_logs table: %w", err)
	}

	// Sectors (setores de atendimento por empresa)
	sectorsTable := `
	CREATE TABLE IF NOT EXISTS sectors (
		id VARCHAR(36) PRIMARY KEY,
		company_id VARCHAR(36) NOT NULL,
		name VARCHAR(128) NOT NULL,
		slug VARCHAR(128),
		is_default BOOLEAN NOT NULL DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(company_id, name),
		UNIQUE(company_id, slug)
	);
	CREATE INDEX IF NOT EXISTS idx_sectors_company ON sectors(company_id);
	`
	if env.Env.DBDialect == "postgres" {
		sectorsTable = `
		CREATE TABLE IF NOT EXISTS sectors (
			id VARCHAR(36) PRIMARY KEY,
			company_id VARCHAR(36) NOT NULL,
			name VARCHAR(128) NOT NULL,
			slug VARCHAR(128),
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(company_id, name),
			UNIQUE(company_id, slug)
		);
		CREATE INDEX IF NOT EXISTS idx_sectors_company ON sectors(company_id);
		`
	}
	if _, err := db.Exec(sectorsTable); err != nil {
		return fmt.Errorf("failed to create sectors table: %w", err)
	}

	// Tentativa de alteração de tabelas existentes para adicionar colunas (caso DB já exista).
	// Ignoramos erros aqui para não quebrar migrações em ambientes já atualizados.
	if _, err := db.Exec(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS sector_id VARCHAR(36)`); err != nil {
		zap.L().Debug("alter chats add sector_id ignored", zap.Error(err))
	}
	if env.Env.DBDialect == "postgres" {
		if _, err := db.Exec(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'aguardando'`); err != nil {
			zap.L().Debug("alter chats add status ignored", zap.Error(err))
		}
	} else {
		// SQLite não suporta IF NOT EXISTS para ADD COLUMN; tentamos simples e ignoramos erro de coluna duplicada.
		if _, err := db.Exec(`ALTER TABLE chats ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'aguardando'`); err != nil {
			zap.L().Debug("alter chats add status (sqlite) ignored", zap.Error(err))
		}
	}

	// Índice por setor: criado após garantir que a coluna exista.
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_chats_instance_sector ON chats(instance_id, sector_id)`); err != nil {
		zap.L().Debug("create idx_chats_instance_sector ignored", zap.Error(err))
	}

	// instance_users: quais usuários podem acessar cada instância (role=user só vê as que está atribuído)
	instanceUsersTable := `
	CREATE TABLE IF NOT EXISTS instance_users (
		instance_id VARCHAR(255) NOT NULL,
		user_id VARCHAR(36) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (instance_id, user_id),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_instance_users_user ON instance_users(user_id);
	`
	if _, err := db.Exec(instanceUsersTable); err != nil {
		return fmt.Errorf("failed to create instance_users table: %w", err)
	}

	// sector_users: quais usuários podem acessar cada setor (role=user só vê setores atribuídos; Geral só admin)
	sectorUsersTable := `
	CREATE TABLE IF NOT EXISTS sector_users (
		sector_id VARCHAR(36) NOT NULL,
		user_id VARCHAR(36) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (sector_id, user_id),
		FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_sector_users_user ON sector_users(user_id);
	`
	if _, err := db.Exec(sectorUsersTable); err != nil {
		return fmt.Errorf("failed to create sector_users table: %w", err)
	}

	// Quick replies (comandos /comando por empresa)
	quickRepliesTable := `
	CREATE TABLE IF NOT EXISTS quick_replies (
		id VARCHAR(36) PRIMARY KEY,
		company_id VARCHAR(36) NOT NULL,
		command VARCHAR(128) NOT NULL,
		message TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(company_id, command)
	);
	CREATE INDEX IF NOT EXISTS idx_quick_replies_company ON quick_replies(company_id);
	`
	if env.Env.DBDialect == "postgres" {
		quickRepliesTable = `
		CREATE TABLE IF NOT EXISTS quick_replies (
			id VARCHAR(36) PRIMARY KEY,
			company_id VARCHAR(36) NOT NULL,
			command VARCHAR(128) NOT NULL,
			message TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(company_id, command)
		);
		CREATE INDEX IF NOT EXISTS idx_quick_replies_company ON quick_replies(company_id);
		`
	}
	if _, err := db.Exec(quickRepliesTable); err != nil {
		return fmt.Errorf("failed to create quick_replies table: %w", err)
	}

	// Flows (fluxos de mensagens por empresa - definição JSON)
	flowsTable := `
	CREATE TABLE IF NOT EXISTS flows (
		id VARCHAR(36) PRIMARY KEY,
		company_id VARCHAR(36) NOT NULL,
		name VARCHAR(255) NOT NULL,
		definition TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_flows_company ON flows(company_id);
	`
	if env.Env.DBDialect == "postgres" {
		flowsTable = `
		CREATE TABLE IF NOT EXISTS flows (
			id VARCHAR(36) PRIMARY KEY,
			company_id VARCHAR(36) NOT NULL,
			name VARCHAR(255) NOT NULL,
			definition TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_flows_company ON flows(company_id);
		`
	}
	if _, err := db.Exec(flowsTable); err != nil {
		return fmt.Errorf("failed to create flows table: %w", err)
	}

	// Flows: coluna opcional de comando e índice único por empresa para bancos já existentes
	addFlowCommand := func(query string) {
		if _, err := db.Exec(query); err != nil {
			if !strings.Contains(err.Error(), "already exists") &&
				!strings.Contains(err.Error(), "duplicate") &&
				!strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
				zap.L().Warn("flows migration", zap.String("query", query), zap.Error(err))
			}
		}
	}
	if env.Env.DBDialect == "postgres" {
		addFlowCommand("ALTER TABLE flows ADD COLUMN command VARCHAR(64)")
		addFlowCommand("CREATE UNIQUE INDEX IF NOT EXISTS idx_flows_company_command ON flows(company_id, command)")
	} else {
		addFlowCommand("ALTER TABLE flows ADD COLUMN command VARCHAR(64)")
		// SQLite não suporta IF NOT EXISTS em UNIQUE constraint, mas aceita em index
		addFlowCommand("CREATE UNIQUE INDEX IF NOT EXISTS idx_flows_company_command ON flows(company_id, command)")
	}

	// Mensagens agendadas (admin/scheduling)
	scheduledTable := `
	CREATE TABLE IF NOT EXISTS scheduled_messages (
		id VARCHAR(36) PRIMARY KEY,
		company_id VARCHAR(36) NOT NULL,
		instance_id VARCHAR(255) NOT NULL,
		remote_jid VARCHAR(255) NOT NULL,
		message_type VARCHAR(32) NOT NULL DEFAULT 'text',
		content TEXT NOT NULL DEFAULT '',
		media_url TEXT NOT NULL DEFAULT '',
		scheduled_at TIMESTAMP NOT NULL,
		status VARCHAR(32) NOT NULL DEFAULT 'pending',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		sent_at TIMESTAMP,
		error_msg TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_scheduled_company_status ON scheduled_messages(company_id, status);
	CREATE INDEX IF NOT EXISTS idx_scheduled_at_status ON scheduled_messages(scheduled_at, status);
	`
	if env.Env.DBDialect == "postgres" {
		scheduledTable = `
		CREATE TABLE IF NOT EXISTS scheduled_messages (
			id VARCHAR(36) PRIMARY KEY,
			company_id VARCHAR(36) NOT NULL,
			instance_id VARCHAR(255) NOT NULL,
			remote_jid VARCHAR(255) NOT NULL,
			message_type VARCHAR(32) NOT NULL DEFAULT 'text',
			content TEXT NOT NULL DEFAULT '',
			media_url TEXT NOT NULL DEFAULT '',
			scheduled_at TIMESTAMP NOT NULL,
			status VARCHAR(32) NOT NULL DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			sent_at TIMESTAMP,
			error_msg TEXT NOT NULL DEFAULT ''
		);
		CREATE INDEX IF NOT EXISTS idx_scheduled_company_status ON scheduled_messages(company_id, status);
		CREATE INDEX IF NOT EXISTS idx_scheduled_at_status ON scheduled_messages(scheduled_at, status);
		`
	}
	if _, err := db.Exec(scheduledTable); err != nil {
		return fmt.Errorf("failed to create scheduled_messages table: %w", err)
	}

	// Campanhas de raspagem (sherlock scrapes)
	scrapesTable := `
	CREATE TABLE IF NOT EXISTS scrapes (
		id VARCHAR(36) PRIMARY KEY,
		company_id VARCHAR(36) NOT NULL,
		user_id VARCHAR(36) NOT NULL DEFAULT '',
		keyword VARCHAR(255) NOT NULL,
		location VARCHAR(255) NOT NULL,
		status VARCHAR(32) NOT NULL DEFAULT 'running',
		total_leads INTEGER NOT NULL DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_scrapes_company ON scrapes(company_id, created_at DESC);
	`
	if env.Env.DBDialect == "postgres" {
		scrapesTable = `
		CREATE TABLE IF NOT EXISTS scrapes (
			id VARCHAR(36) PRIMARY KEY,
			company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
			user_id VARCHAR(36) NOT NULL DEFAULT '',
			keyword VARCHAR(255) NOT NULL,
			location VARCHAR(255) NOT NULL,
			status VARCHAR(32) NOT NULL DEFAULT 'running',
			total_leads INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_scrapes_company ON scrapes(company_id, created_at DESC);
		`
	}
	if _, err := db.Exec(scrapesTable); err != nil {
		return fmt.Errorf("failed to create scrapes table: %w", err)
	}

	// Leads de prospecção (sherlock)
	leadsTable := `
	CREATE TABLE IF NOT EXISTS leads (
		id VARCHAR(36) PRIMARY KEY,
		company_id VARCHAR(36) NOT NULL,
		source_id VARCHAR(255) DEFAULT '',
		name VARCHAR(255) NOT NULL,
		phone VARCHAR(20) DEFAULT '',
		address TEXT DEFAULT '',
		website VARCHAR(1024) DEFAULT '',
		email VARCHAR(255) DEFAULT '',
		rating REAL DEFAULT 0,
		reviews INTEGER DEFAULT 0,
		kanban_status VARCHAR(32) DEFAULT 'prospeccao',
		enrichment_status VARCHAR(32) DEFAULT 'CAPTURADO',
		notes TEXT DEFAULT '',
		estimated_value REAL DEFAULT 0,
		tags VARCHAR(512) DEFAULT '',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
	);
	CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
	CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(company_id, kanban_status);
	`
	if env.Env.DBDialect == "postgres" {
		leadsTable = `
		CREATE TABLE IF NOT EXISTS leads (
			id VARCHAR(36) PRIMARY KEY,
			company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
			source_id VARCHAR(255) DEFAULT '',
			name VARCHAR(255) NOT NULL,
			phone VARCHAR(20) DEFAULT '',
			address TEXT DEFAULT '',
			website VARCHAR(1024) DEFAULT '',
			email VARCHAR(255) DEFAULT '',
			rating DECIMAL(4,2) DEFAULT 0,
			reviews INTEGER DEFAULT 0,
			kanban_status VARCHAR(32) DEFAULT 'prospeccao',
			enrichment_status VARCHAR(32) DEFAULT 'CAPTURADO',
			notes TEXT DEFAULT '',
			estimated_value DECIMAL(12,2) DEFAULT 0,
			tags VARCHAR(512) DEFAULT '',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
		CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(company_id, kanban_status);
		`
	}
	if _, err := db.Exec(leadsTable); err != nil {
		return fmt.Errorf("failed to create leads table: %w", err)
	}

	// Leads: colunas extras para integração com Sherlock (migration para DBs existentes)
	addLeadCol := func(col string, def string) {
		q := fmt.Sprintf("ALTER TABLE leads ADD COLUMN %s %s", col, def)
		if _, err := db.Exec(q); err != nil {
			if !strings.Contains(err.Error(), "already exists") && !strings.Contains(err.Error(), "duplicate column") {
				zap.L().Warn("leads migration: add column", zap.String("col", col), zap.Error(err))
			}
		}
	}
	addLeadCol("scrape_id", "VARCHAR(36) DEFAULT NULL")
	addLeadCol("nicho", "VARCHAR(255) DEFAULT ''")
	addLeadCol("resumo", "TEXT DEFAULT ''")
	addLeadCol("tipo_telefone", "VARCHAR(50) DEFAULT ''")
	addLeadCol("link_whatsapp", "VARCHAR(255) DEFAULT ''")
	addLeadCol("instagram", "VARCHAR(255) DEFAULT ''")
	addLeadCol("facebook", "VARCHAR(255) DEFAULT ''")
	addLeadCol("linkedin", "VARCHAR(255) DEFAULT ''")
	addLeadCol("tiktok", "VARCHAR(255) DEFAULT ''")
	addLeadCol("youtube", "VARCHAR(255) DEFAULT ''")
	addLeadCol("cnpj", "VARCHAR(20) DEFAULT ''")
	addLeadCol("ai_analysis", "TEXT DEFAULT NULL")
	// Índice para buscar leads por campanha
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_leads_scrape ON leads(scrape_id)`); err != nil {
		if !strings.Contains(err.Error(), "already exists") {
			zap.L().Warn("leads migration: create idx_leads_scrape", zap.Error(err))
		}
	}

	// Configurações de IA por empresa
	aiSettingsTable := `
	CREATE TABLE IF NOT EXISTS company_ai_settings (
		company_id   VARCHAR(36) PRIMARY KEY,
		company_name VARCHAR(255) NOT NULL DEFAULT '',
		nicho        VARCHAR(255) NOT NULL DEFAULT '',
		oferta       TEXT        NOT NULL DEFAULT '',
		tom_de_voz   VARCHAR(100) NOT NULL DEFAULT '',
		updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
	);
	`
	if env.Env.DBDialect == "postgres" {
		aiSettingsTable = `
		CREATE TABLE IF NOT EXISTS company_ai_settings (
			company_id   VARCHAR(36) PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
			company_name VARCHAR(255) NOT NULL DEFAULT '',
			nicho        VARCHAR(255) NOT NULL DEFAULT '',
			oferta       TEXT        NOT NULL DEFAULT '',
			tom_de_voz   VARCHAR(100) NOT NULL DEFAULT '',
			updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);
		`
	}
	if _, err := db.Exec(aiSettingsTable); err != nil {
		return fmt.Errorf("failed to create company_ai_settings table: %w", err)
	}

	// Garante que super_admins sem empresa recebam a empresa padrão,
	// evitando falha de FK NOT NULL ao salvar leads.
	defaultCompanySQL := `
	INSERT INTO companies (id, nome, cnpj, email, ativo)
	VALUES ('00000000-0000-0000-0000-000000000001', 'Empresa Padrão', '00.000.000/0000-00', 'admin@whatsmiau.com', true)
	`
	if env.Env.DBDialect == "postgres" {
		defaultCompanySQL += " ON CONFLICT (id) DO NOTHING"
	} else {
		defaultCompanySQL = `INSERT OR IGNORE INTO companies (id, nome, cnpj, email, ativo)
		VALUES ('00000000-0000-0000-0000-000000000001', 'Empresa Padrão', '00.000.000/0000-00', 'admin@whatsmiau.com', 1)`
	}
	if _, err := db.Exec(defaultCompanySQL); err != nil {
		zap.L().Warn("migrations: could not ensure default company", zap.Error(err))
	}
	if _, err := db.Exec(`UPDATE users SET company_id = '00000000-0000-0000-0000-000000000001' WHERE role = 'super_admin' AND (company_id IS NULL OR company_id = '')`); err != nil {
		zap.L().Warn("migrations: could not assign default company to super_admin", zap.Error(err))
	}

	zap.L().Info("Migrations completed successfully")
	return nil
}

func SeedSuperAdmin() error {
	db, err := sql.Open(env.Env.DBDialect, env.Env.DBURL)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	// Check if super admin already exists
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'super_admin'").Scan(&count)
	if err != nil {
		// Table might not exist yet, that's ok
		return nil
	}

	if count > 0 {
		zap.L().Info("Super admin user already exists, skipping seed")
		return nil
	}

	zap.L().Info("No super admin found. Please create one using: ./create-super-admin.sh")
	return nil
}

