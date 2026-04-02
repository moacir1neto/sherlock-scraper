package dto

type ExtractLeadsRequest struct {
	Keyword  string `json:"keyword" validate:"required,min=2"`
	Location string `json:"location" validate:"required,min=2"`
	Limit    int    `json:"limit" validate:"omitempty,min=1,max=100"`
}

type SherlockLead struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Address string `json:"address,omitempty"`
	Website string `json:"website,omitempty"`
	Rating  string `json:"rating,omitempty"`
	Reviews string `json:"reviews,omitempty"`
}

type ExtractLeadsResponse struct {
	Total int            `json:"total"`
	Leads []SherlockLead `json:"leads"`
}
