FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn==23.*
COPY app ./app
COPY scripts ./scripts

EXPOSE 5000
# Create the tables and the admin user, then serve the API
CMD ["sh", "-c", "python -m scripts.seed && gunicorn --bind 0.0.0.0:5000 --workers 2 'app:create_app()'"]
