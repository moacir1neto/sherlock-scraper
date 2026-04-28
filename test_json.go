package main

import (
	"encoding/json"
	"fmt"
)

type GoogleData struct {
	NotaGeral       string `json:"nota_geral,omitempty"`
	TotalAvaliacoes string `json:"total_avaliacoes,omitempty"`
}

func main() {
	jsonData1 := []byte(`{"NotaGeral":"4,8", "TotalAvaliacoes":"71"}`)
	var gd1 GoogleData
	json.Unmarshal(jsonData1, &gd1)
	fmt.Printf("Parsed capital keys: NotaGeral=%q, TotalAvaliacoes=%q\n", gd1.NotaGeral, gd1.TotalAvaliacoes)

	jsonData2 := []byte(`{"nota_geral":"4,8", "total_avaliacoes":"71"}`)
	var gd2 GoogleData
	json.Unmarshal(jsonData2, &gd2)
	fmt.Printf("Parsed lowercase keys: NotaGeral=%q, TotalAvaliacoes=%q\n", gd2.NotaGeral, gd2.TotalAvaliacoes)
}
