from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta
import os

# Getting the project root directory
project_root = os.path.expanduser('~/Documents/reddit-data-analysis')

# Default arguments for the DAG
default_args = {
    'owner': 'shreya',
    'depends_on_past': False,
    'start_date': datetime(2026, 2, 3),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# Creating the DAG
dag = DAG(
    'reddit_data_pipeline',
    default_args=default_args,
    description='Automated Reddit data ingestion and processing pipeline',
    schedule_interval='0 9 * * *',  # Run daily at 9 AM
    catchup=False,
)

# Task 1: Ingest data from Reddit API
ingest_task = BashOperator(
    task_id='ingest_reddit_data',
    bash_command=f'cd {project_root} && python backend/scripts/data_ingestion.py',
    dag=dag,
)

# Task 2: Process data and upload to S3
process_task = BashOperator(
    task_id='process_reddit_data',
    bash_command=f'cd {project_root} && python backend/scripts/data_processing.py',
    dag=dag,
)

# Setting task dependencies (process runs after ingestion)
ingest_task >> process_task