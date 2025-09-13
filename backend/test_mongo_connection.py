import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_mongodb_connection():
    """Test MongoDB connection"""
    try:
        # Get MongoDB URI from environment
        mongo_uri = os.getenv('MONGO_URI')
        
        if not mongo_uri:
            print("MONGO_URI not found in environment variables")
            print("Please add your MongoDB connection string to the .env file:")
            print("MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority")
            return False
        
        print("Attempting to connect to MongoDB...")
        print(f"URI: {mongo_uri[:20]}...{mongo_uri[-20:] if len(mongo_uri) > 40 else mongo_uri}")
        
        # Create client with SSL parameters and test connection
        client = MongoClient(
            mongo_uri,
            tls=True,
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000
        )
        
        # Test the connection
        client.admin.command('ping')
        
        # Get database info
        db = client['cognify']
        collections = db.list_collection_names()
        
        print("Successfully connected to MongoDB!")
        print(f"Database: cognify")
        print(f"Existing collections: {collections if collections else 'None (new database)'}")
        
        # Test creating a sample document
        test_collection = db['test_connection']
        test_doc = {"test": True, "message": "Connection successful"}
        result = test_collection.insert_one(test_doc)
        print(f"Test document inserted with ID: {result.inserted_id}")
        
        # Clean up test document
        test_collection.delete_one({"_id": result.inserted_id})
        print("Test document cleaned up")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        print("\nTroubleshooting tips:")
        print("1. Check your MONGO_URI in the .env file")
        print("2. Ensure your IP address is whitelisted in MongoDB Atlas")
        print("3. Verify your username and password are correct")
        print("4. Make sure your cluster is running")
        return False

if __name__ == "__main__":
    test_mongodb_connection()
