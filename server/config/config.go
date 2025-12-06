package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Database struct {
		User     string `yaml:"user"`
		Password string `yaml:"password"`
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		DBName   string `yaml:"dbname"`
		Charset  string `yaml:"charset"`
	} `yaml:"database"`
}

func LoadConfig() (*Config, error) {
	// Priority 1: Production path / Config Volume
	paths := []string{
		"/config/trace_config.yaml",
		"config.yaml",
		"server/config.yaml",
	}

	var file *os.File
	var err error
	var loadedPath string

	for _, path := range paths {
		file, err = os.Open(path)
		if err == nil {
			loadedPath = path
			break
		}
	}

	if file == nil {
		return nil, fmt.Errorf("config file not found in paths: %v", paths)
	}
	defer file.Close()

	fmt.Printf("Loading config from: %s\n", loadedPath)

	var config Config
	decoder := yaml.NewDecoder(file)
	if err := decoder.Decode(&config); err != nil {
		return nil, err
	}

	return &config, nil
}
