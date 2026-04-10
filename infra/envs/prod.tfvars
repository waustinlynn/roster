env                        = "prod"
aws_region                 = "us-east-1"
log_retention_days         = 30
glacier_transition_days    = 30
availability_zones         = ["us-east-1a", "us-east-1b"]
redpanda_cpu               = 2048
redpanda_memory            = 4096
container_insights_enabled = true
# api_image_tag and redpanda_image_tag have no defaults — supply on CLI:
# terraform apply -var-file=envs/prod.tfvars -var="api_image_tag=1.0.0" -var="redpanda_image_tag=v23.3.1"
