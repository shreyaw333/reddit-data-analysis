import json
import pandas as pd
from textblob import TextBlob
from datetime import datetime
import os
import boto3
from dotenv import load_dotenv

# Loading environment variables
load_dotenv()

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

def process_reddit_data(input_file):
    """Process raw Reddit data and add metrics"""
    
    print(f"Processing file: {input_file}")
    
    # Loading raw JSON data
    with open(input_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    
    # Converting to DataFrame for easier processing
    df = pd.DataFrame(raw_data)
    
    print(f"Total posts loaded: {len(df)}")
    
    # Adding engagement metric (comments + score)
    df['engagement'] = df['num_comments'] + df['score']
    
    # Calculating sentiment on title and post text combined
    df['combined_text'] = df['title'] + ' ' + df['post_text'].fillna('')
    df['sentiment_score'] = df['combined_text'].apply(calculate_sentiment)
    df['sentiment_category'] = df['sentiment_score'].apply(categorize_sentiment)
    
    # Adding processed timestamp
    df['processed_at'] = datetime.now().isoformat()
    
    # Converting created_utc to datetime for easier analysis
    df['created_date'] = pd.to_datetime(df['created_utc'])
    df['created_hour'] = df['created_date'].dt.hour
    df['created_day'] = df['created_date'].dt.day_name()
    
    # Dropping the combined text column (not needed in final output)
    df = df.drop('combined_text', axis=1)
    
    print(f"Processing complete!")
    print(f"Sentiment distribution:")
    print(df['sentiment_category'].value_counts())
    
    return df

def save_processed_data(df, output_file):
    """Save processed data as CSV"""
    
    # Creating processed data directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # Saving to CSV
    df.to_csv(output_file, index=False, encoding='utf-8')
    print(f"Processed data saved to: {output_file}")

if __name__ == "__main__":
    # Testing locally with the latest raw file
    raw_files = sorted(os.listdir('data/raw'))
    if raw_files:
        latest_file = raw_files[-1]
        input_path = f'data/raw/{latest_file}'
        
        # Processing the data
        processed_df = process_reddit_data(input_path)
        
        # Generating output filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_path = f'data/processed/reddit_processed_{timestamp}.csv'
        
        # Saving processed data
        save_processed_data(processed_df, output_path)
        
        print("\nProcessing complete! Check data/processed/ folder")
    else:
        print("No raw data files found!")

    # Initializing S3 client
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_DEFAULT_REGION')
    )

    # Uploading to S3
    s3_bucket = os.getenv('S3_BUCKET_NAME')
    s3_key = f"processed-data/{os.path.basename(output_path)}"

    print(f"Uploading to S3: s3://{s3_bucket}/{s3_key}")
    s3_client.upload_file(output_path, s3_bucket, s3_key)
    print("Successfully uploaded to S3!")