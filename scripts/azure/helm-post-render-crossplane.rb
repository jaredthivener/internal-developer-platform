#!/usr/bin/env ruby

require 'yaml'

def ensure_container_probes!(container, deployment_name)
  case deployment_name
  when 'crossplane'
    container['readinessProbe'] ||= {
      'httpGet' => {
        'path' => '/readyz',
        'port' => 'readyz'
      },
      'periodSeconds' => 10,
      'timeoutSeconds' => 1,
      'failureThreshold' => 3
    }
    container['livenessProbe'] ||= {
      'httpGet' => {
        'path' => '/healthz',
        'port' => 'readyz'
      },
      'initialDelaySeconds' => 30,
      'periodSeconds' => 20,
      'timeoutSeconds' => 1,
      'failureThreshold' => 3
    }
  when 'crossplane-rbac-manager'
    socket_probe = {
      'tcpSocket' => {
        'port' => 8080
      },
      'periodSeconds' => 10,
      'timeoutSeconds' => 1,
      'failureThreshold' => 3
    }

    container['readinessProbe'] ||= socket_probe
    container['livenessProbe'] ||= socket_probe.merge('initialDelaySeconds' => 30, 'periodSeconds' => 20)
  end
end

input = STDIN.read
documents = YAML.load_stream(input)
rendered = documents.compact.map do |document|
  if document.is_a?(Hash) && document['kind'] == 'ClusterRole' && document.key?('aggregationRule') && !document.key?('rules')
    document['rules'] = []
  end

  if document.is_a?(Hash) && document['kind'] == 'Deployment'
    deployment_name = document.dig('metadata', 'name')
    containers = document.dig('spec', 'template', 'spec', 'containers')

    if ['crossplane', 'crossplane-rbac-manager'].include?(deployment_name) && containers.is_a?(Array)
      containers.each do |container|
        ensure_container_probes!(container, deployment_name)
      end
    end
  end

  YAML.dump(document)
end

STDOUT.write(rendered.join("---\n"))