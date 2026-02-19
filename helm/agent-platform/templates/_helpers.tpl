{{/*
Expand the name of the chart.
*/}}
{{- define "agent-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "agent-platform.fullname" -}}
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
{{- define "agent-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "agent-platform.labels" -}}
helm.sh/chart: {{ include "agent-platform.chart" . }}
{{ include "agent-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "agent-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agent-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* ---- Backend ---- */}}

{{- define "agent-platform.backend.fullname" -}}
{{- printf "%s-backend" (include "agent-platform.fullname" .) }}
{{- end }}

{{- define "agent-platform.backend.labels" -}}
{{ include "agent-platform.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{- define "agent-platform.backend.selectorLabels" -}}
{{ include "agent-platform.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/* ---- Frontend ---- */}}

{{- define "agent-platform.frontend.fullname" -}}
{{- printf "%s-frontend" (include "agent-platform.fullname" .) }}
{{- end }}

{{- define "agent-platform.frontend.labels" -}}
{{ include "agent-platform.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "agent-platform.frontend.selectorLabels" -}}
{{ include "agent-platform.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Backend image
*/}}
{{- define "agent-platform.backend.image" -}}
{{- printf "%s:%s" .Values.backend.image.repository (default .Chart.AppVersion .Values.backend.image.tag) }}
{{- end }}

{{/*
Frontend image
*/}}
{{- define "agent-platform.frontend.image" -}}
{{- printf "%s:%s" .Values.frontend.image.repository (default .Chart.AppVersion .Values.frontend.image.tag) }}
{{- end }}

{{/*
Secret name (supports existingSecret)
*/}}
{{- define "agent-platform.secretName" -}}
{{- if .Values.backend.secret.existingSecret }}
{{- .Values.backend.secret.existingSecret }}
{{- else }}
{{- include "agent-platform.fullname" . }}
{{- end }}
{{- end }}
