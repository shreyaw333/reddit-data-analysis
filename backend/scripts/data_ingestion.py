import praw
import json
import os
import boto3
from datetime import datetime
from dotenv import load_dotenv

# Loading environment variables from .env file
load_dotenv()

# Fetching Reddit API credentials from environment
client_id = os.getenv('REDDIT_CLIENT_ID')
client_secret = os.getenv('REDDIT_CLIENT_SECRET')
user_agent = os.getenv('REDDIT_USER_AGENT')

# Fetching AWS credentials from environment
aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
aws_region = os.getenv('AWS_DEFAULT_REGION')
s3_bucket = os.getenv('S3_BUCKET_NAME')
s3_raw_prefix = os.getenv('S3_RAW_DATA_PREFIX')

# Initializing Reddit API connection
reddit = praw.Reddit(
    client_id=client_id,
    client_secret=client_secret,
    user_agent=user_agent
)

# Initializing AWS S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region
)

# Defining the subreddits to monitor
subreddits_to_monitor = ['technology', 'programming', 'datascience', 'MachineLearning', 'Python']

# Storing all posts data here
all_posts_data = []

print("Starting Reddit data ingestion...")

# Looping through each subreddit
for subreddit_name in subreddits_to_monitor:
    print(f"Fetching posts from r/{subreddit_name}...")
    
    # Fetching the subreddit object
    subreddit = reddit.subreddit(subreddit_name)
    
    # Fetching hot posts from last 24 hours (limit 100 posts per subreddit)
    for post in subreddit.hot(limit=100):
        
        # Extracting all the data we need from each post
        post_data = {
            'post_id': post.id,
            'title': post.title,
            'author': str(post.author) if post.author else '[deleted]',
            'subreddit': subreddit_name,
            'created_utc': datetime.fromtimestamp(post.created_utc).isoformat(),
            'score': post.score,
            'upvote_ratio': post.upvote_ratio,
            'num_comments': post.num_comments,
            'post_text': post.selftext,
            'url': post.url,
            'flair': post.link_flair_text,
            'is_self': post.is_self,
            'gilded': post.gilded,
            'over_18': post.over_18
        }
        
        # Adding this post to our collection
        all_posts_data.append(post_data)

print(f"Total posts collected: {len(all_posts_data)}")

# Creating raw data directory if it doesn't exist
os.makedirs('data/raw', exist_ok=True)

# Generating filename with current timestamp
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
filename = f'data/raw/reddit_posts_{timestamp}.json'

# Saving all posts to JSON file locally
with open(filename, 'w', encoding='utf-8') as f:
    json.dump(all_posts_data, f, indent=2, ensure_ascii=False)

print(f"Data saved locally to {filename}")

# Uploading to S3
s3_key = f"{s3_raw_prefix}reddit_posts_{timestamp}.json"
print(f"Uploading to S3: s3://{s3_bucket}/{s3_key}")

try:
    s3_client.upload_file(filename, s3_bucket, s3_key)
    print(f"Successfully uploaded to S3!")
except Exception as e:
    print(f"Error uploading to S3: {e}")

print("Ingestion complete!")