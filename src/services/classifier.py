# src/services/classifier.py
import json
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import re
import unicodedata
import joblib
import os
from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS
from datetime import datetime

class DocumentClassifier:
    def __init__(self):
        self.pipeline = None
        self.model_path = "src/services/modelo_entrenado.joblib"
        self.training_data_path = "src/services/ejemplos_documentos.json" # Path for fallback training data
        self.document_types = [ # Ensure this list is comprehensive or loaded dynamically if possible
            "REGISTRO DE CAPACITACIÓN", "REGLAMENTO INTERNO SALUD, HIGIENE Y SEGURIDAD", 
            "RESOLUCIÓN PLAN DE MANEJO", "ENTREGA EPP", "CONTRATO DE TRABAJO", 
            "DERECHO A SABER", "AVISO DE EJECUCIÓN DE FAENA", "CONTRATO COMPRA Y VENTA", 
            "CONSULTA ANTECEDENTE BIEN RAÍZ (SII)", "PLANO DEL PREDIO", 
            "ESCRITURA O TÍTULOS DE DOMINIO"
        ]
        # Add any other types present in ejemplos_documentos.json if not covered,
        # or consider deriving this list from the training data labels dynamically.

    def _log(self, message):
        print(f"[{datetime.utcnow().isoformat()}] {message}")

    def preprocess_text(self, text):
        text = text.lower()
        text = unicodedata.normalize('NFKD', text)
        text = ''.join([c for c in text if not unicodedata.combining(c)])
        text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def load_training_data(self, json_file_path):
        self._log(f"Attempting to load training data from: {json_file_path}")
        try:
            with open(json_file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
            
            if 'documentos' not in data:
                self._log("Error: JSON training data must have a 'documentos' key.")
                return None, None
            
            texts, labels = [], []
            for i, doc in enumerate(data['documentos']):
                if 'document_type' not in doc or 'text_content' not in doc:
                    self._log(f"Error: Document {i+1} in JSON is missing 'document_type' or 'text_content'. Keys: {list(doc.keys())}")
                    return None, None
                texts.append(self.preprocess_text(doc['text_content']))
                labels.append(doc['document_type'])
            
            self._log(f"✅ Successfully loaded {len(texts)} documents for training from {json_file_path}.")
            unique_labels = set(labels)
            self._log(f"✅ Found {len(unique_labels)} unique document types in training data.")
            # Update document_types if new types are found, or ensure they are pre-defined
            # For simplicity, we assume pre-defined types cover those in training data.
            # A more dynamic approach might update self.document_types here.
            return texts, labels
        except FileNotFoundError:
            self._log(f"❌ Error: Training data file not found at {json_file_path}")
            return None, None
        except json.JSONDecodeError as e:
            self._log(f"❌ Error: Invalid JSON format in {json_file_path}. Details: {e}")
            return None, None
        except Exception as e:
            self._log(f"❌ Error loading training data: {e}")
            return None, None

    def train_model(self, texts, labels):
        self._log("Starting model training...")
        if not texts or not labels:
            self._log("Error: No data provided for model training.")
            return False
        
        self.pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(max_features=5000, ngram_range=(1, 2), min_df=1, max_df=0.95)),
            ('classifier', MultinomialNB(alpha=0.1))
        ])
        
        try:
            self.pipeline.fit(texts, labels)
            self._log(f"✅ Model trained successfully with {len(texts)} documents and {len(set(labels))} unique types.")
            # Update self.document_types based on training data if necessary
            # self.document_types = list(self.pipeline.classes_) 
            # self._log(f"Model classes updated to: {self.document_types}")
            return True
        except Exception as e:
            self._log(f"❌ Error during model training: {e}")
            return False

    def predict_document_type(self, text):
        self._log(f"Received text for prediction: '{text[:100]}...'")
        if self.pipeline is None:
            self._log("Error: Model pipeline is not available for prediction.")
            return {"error": "Model not available. It might not have been loaded or trained."}

        processed_text = self.preprocess_text(text)
        try:
            prediction = self.pipeline.predict([processed_text])[0]
            probabilities = self.pipeline.predict_proba([processed_text])[0]
            
            # Ensure pipeline has classes_ attribute; it should after fitting
            if not hasattr(self.pipeline, 'classes_'):
                self._log("Error: Model pipeline has not been fitted correctly (missing 'classes_' attribute).")
                return {"error": "Model not fitted correctly."}

            classes = self.pipeline.classes_
            prob_dict = dict(zip(classes, probabilities))
            sorted_probs = sorted(prob_dict.items(), key=lambda item: item[1], reverse=True)
            
            self._log(f"Prediction successful: Type '{prediction}', Confidence: {max(probabilities):.4f}")
            return {
                'prediction': prediction,
                'confidence': max(probabilities),
                'all_probabilities': sorted_probs[:5]
            }
        except Exception as e:
            self._log(f"❌ Error during prediction: {e}")
            return {"error": f"Prediction error: {e}"}

    def save_model(self):
        self._log(f"Attempting to save model to: {self.model_path}")
        if self.pipeline is None:
            self._log("❌ Error: No model pipeline to save.")
            return False
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True) # Ensure directory exists
            joblib.dump(self.pipeline, self.model_path)
            self._log(f"✅ Model saved successfully to {self.model_path}")
            return True
        except Exception as e:
            self._log(f"❌ Error saving model: {e}")
            return False

    def load_model(self, attempt_fallback_training=False):
        self._log(f"Attempting to load model from: {self.model_path}")
        # Adjust path if running in a different context (e.g. subtask might change current dir)
        effective_model_path = self.model_path
        if not os.path.isabs(effective_model_path): # If path is relative
             script_dir = os.path.dirname(__file__)
             potential_path_from_script_dir = os.path.join(script_dir, os.path.basename(self.model_path))
             # Fallback to check path relative to script dir, then original relative path
             if os.path.exists(potential_path_from_script_dir):
                  effective_model_path = potential_path_from_script_dir
             elif not os.path.exists(effective_model_path) and os.path.exists(os.path.join("src/services", os.path.basename(self.model_path))):
                  # This case for when CWD is project root
                  effective_model_path = os.path.join("src/services", os.path.basename(self.model_path))


        if os.path.exists(effective_model_path):
            try:
                self.pipeline = joblib.load(effective_model_path)
                self._log(f"✅ Model loaded successfully from {effective_model_path}")
                # Dynamically set document_types from loaded model if possible and desired
                if hasattr(self.pipeline, 'classes_'):
                    self.document_types = list(self.pipeline.classes_)
                    self._log(f"Document types updated from loaded model: {self.document_types}")
                return True
            except Exception as e:
                self._log(f"❌ Error loading model from {effective_model_path}: {e}. Model file might be corrupted.")
                self.pipeline = None # Ensure pipeline is None if loading fails
        else:
            self._log(f"❌ Model file not found at {effective_model_path} (and other checked paths).")

        if attempt_fallback_training:
            self._log("Attempting fallback: Training a new model as pre-trained model was not found or failed to load.")
            
            # Determine training data path relative to script, similar to model path
            effective_training_data_path = self.training_data_path
            if not os.path.isabs(effective_training_data_path):
                 script_dir = os.path.dirname(__file__)
                 potential_training_path_from_script_dir = os.path.join(script_dir, os.path.basename(self.training_data_path))
                 if os.path.exists(potential_training_path_from_script_dir):
                      effective_training_data_path = potential_training_path_from_script_dir
                 elif not os.path.exists(effective_training_data_path) and os.path.exists(os.path.join("src/services", os.path.basename(self.training_data_path))):
                      effective_training_data_path = os.path.join("src/services", os.path.basename(self.training_data_path))


            if not os.path.exists(effective_training_data_path):
                self._log(f"❌ Fallback training failed: Training data file '{effective_training_data_path}' not found.")
                return False

            texts, labels = self.load_training_data(effective_training_data_path)
            if texts and labels:
                if self.train_model(texts, labels):
                    self.save_model() # Save the newly trained model
                    return True # Successfully trained and saved a new model
                else:
                    self._log("❌ Fallback training failed: Error during model training process.")
                    return False
            else:
                self._log("❌ Fallback training failed: Could not load training data.")
                return False
        
        self._log("Model not loaded and fallback training not attempted or failed.")
        return False


app = Flask(__name__)
CORS(app) # Enable CORS for all routes
classifier = DocumentClassifier()

@app.route('/classify', methods=['POST'])
def classify_text_route():
    classifier._log(f"Received request on /classify endpoint.")
    data = request.get_json()
    if not data or 'text' not in data:
        classifier._log("Invalid request to /classify: 'text' field missing.")
        return jsonify({"error": "Invalid input, 'text' field is required"}), 400
    
    text_to_classify = data['text']
    
    if classifier.pipeline is None: # Check if model is loaded
        classifier._log("Model not loaded at request time. Attempting to load/train again.")
        # Try to load, with fallback training if it's not loaded by startup logic
        if not classifier.load_model(attempt_fallback_training=True):
            classifier._log("CRITICAL: Model could not be loaded or trained even on fallback for /classify request.")
            return jsonify({"error": "Model not available and could not be initialized"}), 503 # Service Unavailable

    result = classifier.predict_document_type(text_to_classify)
    
    if "error" in result:
        return jsonify(result), 500 
    return jsonify(result)

def run_flask_app():
    classifier._log("Starting Flask application setup...")
    # Attempt to load the model at startup, with fallback training if it fails
    if not classifier.load_model(attempt_fallback_training=True):
        classifier._log("CRITICAL: Model could not be loaded or trained at startup. The /classify endpoint might fail or re-attempt.")
    else:
        classifier._log("✅ Model ready for use (loaded or trained).")
    
    classifier._log("Starting Flask development server on http://0.0.0.0:5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)

if __name__ == '__main__':
    run_flask_app()
