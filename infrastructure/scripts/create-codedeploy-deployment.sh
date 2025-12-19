#!/bin/bash
# Create CodeDeploy Blue/Green deployment
# Usage: ./create-codedeploy-deployment.sh <environment> <service> <task-definition-arn>

set -e

ENVIRONMENT="${1:-staging}"
SERVICE="${2:-backend}"
TASK_DEFINITION_ARN="${3:-}"
REGION="eu-west-2"

if [ -z "$TASK_DEFINITION_ARN" ]; then
    echo "Error: Task definition ARN is required"
    echo "Usage: $0 <environment> <service> <task-definition-arn>"
    exit 1
fi

APP_NAME="isms-${ENVIRONMENT}-${SERVICE}-app"
DG_NAME="isms-${ENVIRONMENT}-${SERVICE}-dg"

# Determine container name and port
if [ "$SERVICE" = "backend" ]; then
    CONTAINER_NAME="backend"
    CONTAINER_PORT=4000
elif [ "$SERVICE" = "frontend" ]; then
    CONTAINER_NAME="frontend"
    CONTAINER_PORT=80
else
    echo "Error: Service must be 'backend' or 'frontend'"
    exit 1
fi

# Create AppSpec content
APPSPEC=$(cat <<EOF
{
  "version": 0.0,
  "Resources": [{
    "TargetService": {
      "Type": "AWS::ECS::Service",
      "Properties": {
        "TaskDefinition": "${TASK_DEFINITION_ARN}",
        "LoadBalancerInfo": {
          "ContainerName": "${CONTAINER_NAME}",
          "ContainerPort": ${CONTAINER_PORT}
        }
      }
    }
  }]
}
EOF
)

echo "Creating CodeDeploy deployment..."
echo "Application: $APP_NAME"
echo "Deployment Group: $DG_NAME"
echo "Task Definition: $TASK_DEFINITION_ARN"

DEPLOYMENT_ID=$(aws deploy create-deployment \
    --application-name "$APP_NAME" \
    --deployment-group-name "$DG_NAME" \
    --revision "revisionType=AppSpecContent,appSpecContent='${APPSPEC}'" \
    --region "$REGION" \
    --query 'deploymentId' \
    --output text)

echo "Deployment created: $DEPLOYMENT_ID"
echo "Monitor deployment: aws deploy get-deployment --deployment-id $DEPLOYMENT_ID --region $REGION"

