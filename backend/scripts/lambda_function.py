# lambda_function.py

import json
import boto3
import pandas as pd
from textblob import TextBlob
from datetime import datetime
from io import StringIO
import os

# Initializing S3 client
s3_client = boto3.client('s3')

def calculate_sentiment(text):
    """Calculate sentiment polarity using TextBlob"""
    if not text or text == '':
        return 0.0
    try:
        return TextBlob(str(text)).sentiment.polarity
    except:
        return 0.0

def categorize_sentiment(polarity):
    """Categorize sentiment into positive, neutral, negative"""
    if polarity > 0.1:
        return 'positive'
    elif polarity < -0.1:
        return 'negative'
    else:
        return 'neutral'

def lambda_handler(event, context):
    """Main Lambda handler function"""
    
    # Getting bucket name and file key from S3 event
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    
    print(f"Processing file: s3://{bucket}/{key}")
    
    try:
        # Reading raw JSON from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        raw_data = json.loads(response['Body'].read().decode('utf-8'))
        
        # Converting to DataFrame
        df = pd.DataFrame(raw_data)
        print(f"Total posts loaded: {len(df)}")
        
        # Adding engagement metric
        df['engagement'] = df['num_comments'] + df['score']
        
        # Calculating sentiment
        df['combined_text'] = df['title'] + ' ' + df['post_text'].fillna('')
        df['sentiment_score'] = df['combined_text'].apply(calculate_sentiment)
        df['sentiment_category'] = df['sentiment_score'].apply(categorize_sentiment)
        
        # Adding processed timestamp
        df['processed_at'] = datetime.now().isoformat()
        
        # Converting created_utc to datetime
        df['created_date'] = pd.to_datetime(df['created_utc'])
        df['created_hour'] = df['created_date'].dt.hour
        df['created_day'] = df['created_date'].dt.day_name()
        
        # Dropping combined text column
        df = df.drop('combined_text', axis=1)
        
        print(f"Sentiment distribution:")
        print(df['sentiment_category'].value_counts().to_dict())
        
        # Converting DataFrame to CSV
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, index=False)
        
        # Generating output key
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_key = f"processed-data/reddit_processed_{timestamp}.csv"
        
        # Uploading processed CSV to S3
        s3_client.put_object(
            Bucket=bucket,
            Key=output_key,
            Body=csv_buffer.getvalue()
        )
        
        print(f"Processed data saved to: s3://{bucket}/{output_key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Processing complete',
                'output_file': f's3://{bucket}/{output_key}',
                'posts_processed': len(df)
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }