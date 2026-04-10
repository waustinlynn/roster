env                        = "dev"
aws_region                 = "us-east-1"
log_retention_days         = 7
glacier_transition_days    = 90
availability_zones         = ["us-east-1a", "us-east-1b"]
redpanda_cpu               = 1024
redpanda_memory            = 2048
container_insights_enabled = false
# api_image_tag and redpanda_image_tag have no defaults — supply on CLI:
# terraform apply -var-file=envs/dev.tfvars -var="api_image_tag=1.0.0" -var="redpanda_image_tag=v23.3.1"
