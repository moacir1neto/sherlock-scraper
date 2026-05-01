package dto

type CreateLeadRequest struct {
	SourceID string  `json:"source_id"`
	Name     string  `json:"name" validate:"required,min=1,max=255"`
	Phone    string  `json:"phone"`
	Address  string  `json:"address"`
	Website  string  `json:"website"`
	Email    string  `json:"email"`
	Rating   float64 `json:"rating"`
	Reviews  int     `json:"reviews"`
}

type BulkCreateLeadsRequest struct {
	SourceID string              `json:"source_id"`
	Leads    []CreateLeadRequest `json:"leads" validate:"required,min=1"`
}

type UpdateLeadRequest struct {
	Name           string  `json:"name" validate:"required,min=1,max=255"`
	Phone          string  `json:"phone"`
	Address        string  `json:"address"`
	Website        string  `json:"website"`
	Email          string  `json:"email"`
	KanbanStatus   string  `json:"kanban_status" validate:"omitempty,oneof=prospeccao contatado reuniao_agendada negociacao ganho perdido"`
	Notes          string  `json:"notes"`
	EstimatedValue float64 `json:"estimated_value"`
	Tags           string  `json:"tags"`
}

type UpdateLeadStatusRequest struct {
	KanbanStatus string `json:"kanban_status" validate:"required,oneof=prospeccao contatado reuniao_agendada negociacao ganho perdido"`
}

type LeadListResponse struct {
	Leads interface{} `json:"leads"`
	Total int         `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

type BulkAnalyzeRequest struct {
	IDs   []string `json:"ids" validate:"required,min=1"`
	Skill string   `json:"skill"`
}
