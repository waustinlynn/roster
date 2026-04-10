data "aws_caller_identity" "current" {}

module "iam" {
  source     = "./modules/iam"
  env        = var.env
  aws_region = var.aws_region
  account_id = data.aws_caller_identity.current.account_id
}

module "networking" {
  source             = "./modules/networking"
  env                = var.env
  availability_zones = var.availability_zones
}

module "ecs_cluster" {
  source                     = "./modules/ecs-cluster"
  env                        = var.env
  log_retention_days         = var.log_retention_days
  container_insights_enabled = var.container_insights_enabled
}

# Redpanda service is created before event-store so we can pass the task role ARN
# to the bucket policy. Terraform resolves the output reference automatically.
module "redpanda_service" {
  source = "./modules/redpanda-service"

  env                         = var.env
  vpc_id                      = module.networking.vpc_id
  vpc_cidr                    = "10.0.0.0/16"
  public_subnet_ids           = module.networking.public_subnet_ids
  private_subnet_ids          = module.networking.private_subnet_ids
  cluster_arn                 = module.ecs_cluster.cluster_arn
  cluster_name                = module.ecs_cluster.cluster_name
  ecs_task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  log_group_name              = module.ecs_cluster.log_group_name
  aws_region                  = var.aws_region
  event_store_bucket_name     = module.event_store.bucket_name
  event_store_bucket_arn      = module.event_store.bucket_arn
  redpanda_image_tag          = var.redpanda_image_tag
  cpu                         = var.redpanda_cpu
  memory                      = var.redpanda_memory
}

module "event_store" {
  source = "./modules/event-store"

  env                     = var.env
  aws_region              = var.aws_region
  glacier_transition_days = var.glacier_transition_days
  redpanda_task_role_arn  = module.redpanda_service.redpanda_task_role_arn
}

module "vpc_endpoints" {
  source = "./modules/vpc-endpoints"

  env                     = var.env
  vpc_id                  = module.networking.vpc_id
  private_subnet_ids      = module.networking.private_subnet_ids
  private_route_table_ids = module.networking.private_route_table_ids
  aws_region              = var.aws_region
}

module "api_service" {
  source = "./modules/api-service"

  env                         = var.env
  vpc_id                      = module.networking.vpc_id
  public_subnet_ids           = module.networking.public_subnet_ids
  private_subnet_ids          = module.networking.private_subnet_ids
  cluster_arn                 = module.ecs_cluster.cluster_arn
  ecs_task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  log_group_name              = module.ecs_cluster.log_group_name
  aws_region                  = var.aws_region
  ecr_api_repo_url            = module.ecs_cluster.ecr_api_repo_url
  image_tag                   = var.api_image_tag
  redpanda_endpoint           = module.redpanda_service.redpanda_endpoint
  redpanda_task_sg_id         = module.redpanda_service.redpanda_task_sg_id
  vpc_endpoint_sg_id          = module.vpc_endpoints.endpoint_sg_id
}

module "ui_hosting" {
  source     = "./modules/ui-hosting"
  env        = var.env
  aws_region = var.aws_region
}
