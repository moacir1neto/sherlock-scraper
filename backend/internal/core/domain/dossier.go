package domain

// DossierStage identifica a etapa de investigação em progresso.
type DossierStage string

const (
	DossierStageMaps    DossierStage = "maps"
	DossierStageWebsite DossierStage = "website"
	DossierStageSocial  DossierStage = "social"
	DossierStageLLM     DossierStage = "llm"
)

// DossierEventStatus indica o estado de uma etapa do pipeline.
type DossierEventStatus string

const (
	DossierStatusRunning DossierEventStatus = "running"
	DossierStatusDone    DossierEventStatus = "done"
	DossierStatusError   DossierEventStatus = "error"
)

// DossierEvent é o payload publicado no canal Redis dossier:logs:<lead_id>.
// O frontend consome via SSE para exibir progresso em tempo real.
type DossierEvent struct {
	Stage   DossierStage       `json:"stage"`
	Status  DossierEventStatus `json:"status"`
	Message string             `json:"message"`
}
