{{/*
Expand the name of the chart.
*/}}
{{- define "adacor-workplace.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "adacor-workplace.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "adacor-workplace.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "adacor-workplace.labels" -}}
helm.sh/chart: {{ include "adacor-workplace.chart" . }}
{{ include "adacor-workplace.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "adacor-workplace.selectorLabels" -}}
app.kubernetes.io/name: {{ include "adacor-workplace.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* ---- Backend ---- */}}

{{- define "adacor-workplace.backend.fullname" -}}
{{- printf "%s-backend" (include "adacor-workplace.fullname" .) }}
{{- end }}

{{- define "adacor-workplace.backend.labels" -}}
{{ include "adacor-workplace.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{- define "adacor-workplace.backend.selectorLabels" -}}
{{ include "adacor-workplace.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/* ---- Frontend ---- */}}

{{- define "adacor-workplace.frontend.fullname" -}}
{{- printf "%s-frontend" (include "adacor-workplace.fullname" .) }}
{{- end }}

{{- define "adacor-workplace.frontend.labels" -}}
{{ include "adacor-workplace.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "adacor-workplace.frontend.selectorLabels" -}}
{{ include "adacor-workplace.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Backend image
*/}}
{{- define "adacor-workplace.backend.image" -}}
{{- printf "%s:%s" .Values.backend.image.repository (default .Chart.AppVersion .Values.backend.image.tag) }}
{{- end }}

{{/*
Frontend image
*/}}
{{- define "adacor-workplace.frontend.image" -}}
{{- printf "%s:%s" .Values.frontend.image.repository (default .Chart.AppVersion .Values.frontend.image.tag) }}
{{- end }}

{{/* ---- MCP Runner ---- */}}

{{- define "adacor-workplace.mcpRunner.fullname" -}}
{{- printf "%s-mcp-runner" (include "adacor-workplace.fullname" .) }}
{{- end }}

{{- define "adacor-workplace.mcpRunner.labels" -}}
{{ include "adacor-workplace.labels" . }}
app.kubernetes.io/component: mcp-runner
{{- end }}

{{- define "adacor-workplace.mcpRunner.selectorLabels" -}}
{{ include "adacor-workplace.selectorLabels" . }}
app.kubernetes.io/component: mcp-runner
{{- end }}

{{/*
MCP Runner image
*/}}
{{- define "adacor-workplace.mcpRunner.image" -}}
{{- printf "%s:%s" .Values.mcpRunner.image.repository (default .Chart.AppVersion .Values.mcpRunner.image.tag) }}
{{- end }}

{{/*
Secret name (supports existingSecret)
*/}}
{{- define "adacor-workplace.secretName" -}}
{{- if .Values.backend.secret.existingSecret }}
{{- .Values.backend.secret.existingSecret }}
{{- else }}
{{- include "adacor-workplace.fullname" . }}
{{- end }}
{{- end }}
