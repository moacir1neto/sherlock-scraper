package dto

type CreateTagRequest struct {
	Name          string `json:"name" validate:"required,max=128"`
	Color         string `json:"color" validate:"max=32"`
	KanbanEnabled *bool  `json:"kanban_enabled"`
	SortOrder     *int   `json:"sort_order"`
}

type UpdateTagRequest struct {
	ID            string `json:"id" param:"id" validate:"required"`
	Name          string `json:"name" validate:"required,max=128"`
	Color         string `json:"color" validate:"max=32"`
	KanbanEnabled *bool  `json:"kanban_enabled"`
	SortOrder     *int   `json:"sort_order"`
}

type AddChatTagRequest struct {
	TagID string `json:"tag_id" validate:"required"`
}
