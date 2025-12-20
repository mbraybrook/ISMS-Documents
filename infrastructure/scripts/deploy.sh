#!/bin/bash
# Deployment helper script for CloudFormation stacks
# Usage: ./deploy.sh <environment> [profile]

set -e

ENVIRONMENT="${1:-staging}"
AWS_PROFILE="${2:-}"
STACK_NAME="isms-${ENVIRONMENT}"
TEMPLATE_FILE="infrastructure/templates/main.yaml"
PARAMS_FILE="infrastructure/parameters/${ENVIRONMENT}-params.json"
REGION="eu-west-2"

if [ ! -f "$PARAMS_FILE" ]; then
    echo "Error: Parameter file not found: $PARAMS_FILE"
    exit 1
fi

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Error: Template file not found: $TEMPLATE_FILE"
    exit 1
fi

echo "Deploying stack: $STACK_NAME"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"

if [ -n "$AWS_PROFILE" ]; then
    echo "Using AWS profile: $AWS_PROFILE"
    aws cloudformation deploy \
        --template-file "$TEMPLATE_FILE" \
        --stack-name "$STACK_NAME" \
        --parameter-overrides file://"$PARAMS_FILE" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --profile "$AWS_PROFILE" \
        --region "$REGION"
else
    echo "Using default AWS credentials"
    aws cloudformation deploy \
        --template-file "$TEMPLATE_FILE" \
        --stack-name "$STACK_NAME" \
        --parameter-overrides file://"$PARAMS_FILE" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --region "$REGION"
fi

echo "Deployment complete!"



