#!/bin/bash
# Validate CloudFormation templates
# Usage: ./validate-templates.sh

set -e

REGION="eu-west-2"
TEMPLATES_DIR="infrastructure/templates"

echo "Validating CloudFormation templates..."

for template in "$TEMPLATES_DIR"/*.yaml; do
    if [ -f "$template" ]; then
        echo "Validating: $template"
        aws cloudformation validate-template \
            --template-body "file://$template" \
            --region "$REGION" \
            > /dev/null
        if [ $? -eq 0 ]; then
            echo "✓ Valid: $template"
        else
            echo "✗ Invalid: $template"
            exit 1
        fi
    fi
done

echo "All templates are valid!"



