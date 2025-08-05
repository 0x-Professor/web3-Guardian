# SmartBugs Dataset Integration

This directory contains scripts for processing the SmartBugs curated dataset to populate the knowledge base for the RAG (Retrieval-Augmented Generation) pipeline in Web3 Guardian.

## Overview

The SmartBugs dataset contains 143 smart contracts with 208 labeled vulnerabilities across various categories including:
- Reentrancy attacks
- Access control issues
- Arithmetic vulnerabilities (overflow/underflow)
- Denial of Service (DoS)
- Unchecked external calls
- And more...

## Files

### `populate_knowledge_base.py`
Main script for processing the SmartBugs dataset and creating structured knowledge base documents.

**Features:**
- Validates SmartBugs dataset structure
- Extracts vulnerability information from `vulnerabilities.json`
- Creates detailed vulnerability documents with code context
- Handles multiple encoding formats
- Provides comprehensive statistics and error reporting
- Creates structured text files for the RAG pipeline

### `test_smartbugs_integration.py`
Test script that validates the complete integration between SmartBugs processing and the RAG pipeline.

**Features:**
- Tests dataset processing
- Validates RAG pipeline loading with SmartBugs data
- Performs sample contract analysis
- Provides integration verification

## Usage

### Prerequisites

1. **Download SmartBugs Dataset:**
   ```bash
   # Clone or download the SmartBugs curated dataset
   git clone https://github.com/smartbugs/smartbugs-curated.git
   ```

2. **Install Dependencies:**
   Make sure you have all required Python packages installed (should be in your `requirements.txt`).

### Running the Scripts

#### Process SmartBugs Dataset

```bash
# From the backend directory
cd backend

# Basic usage (uses default paths)
python scripts/populate_knowledge_base.py

# Custom paths
python scripts/populate_knowledge_base.py \
    --smartbugs-path ./path/to/smartbugs-curated \
    --knowledge-base-path ./data/knowledge_base \
    --log-level INFO
```

#### Test Integration

```bash
# From the backend directory
cd backend

# Run integration test
python scripts/test_smartbugs_integration.py
```

### Command Line Options

For `populate_knowledge_base.py`:

- `--smartbugs-path`: Path to SmartBugs dataset (default: `./smartbugs-curated`)
- `--knowledge-base-path`: Output directory for knowledge base files (default: `./data/knowledge_base`)
- `--log-level`: Logging verbosity (DEBUG, INFO, WARNING, ERROR)

## Output

The script creates structured text files in the knowledge base directory with the following format:

```
{contract_name}_{vulnerability_category}_{line_start}_{line_end}_{index}.txt
```

Example: `DAO_reentrancy_15_25_0.txt`

Each file contains:
- Contract information
- Vulnerability details
- Code snippet with context (marked vulnerable lines)
- Security implications
- Recommended mitigations
- Learning context

## Integration with RAG Pipeline

The processed documents are automatically loaded by the RAG pipeline through the `_load_smartbugs_documents()` method, which:

1. Scans the knowledge base directory for `.txt` files
2. Creates LangChain Document objects with metadata
3. Integrates with the vector store for similarity search
4. Enables the RAG system to provide context-aware security analysis

## Example Output Statistics

```
SMARTBUGS PROCESSING COMPLETED
============================================================
Total contracts in dataset: 143
Successfully processed contracts: 143
Total vulnerabilities: 208
Documents created: 208
Errors encountered: 0
Knowledge base path: /path/to/data/knowledge_base

Vulnerability Categories:
  - access_control: 45
  - arithmetic: 32
  - denial_of_service: 18
  - reentrancy: 25
  - unchecked_external_calls: 88
============================================================
```

## Troubleshooting

### Common Issues

1. **Dataset not found:**
   - Ensure SmartBugs dataset is downloaded and path is correct
   - Check that `vulnerabilities.json` exists in the dataset root

2. **Permission errors:**
   - Ensure write permissions for the knowledge base directory
   - Check disk space availability

3. **Encoding issues:**
   - The script handles both UTF-8 and Latin-1 encodings
   - If other encoding issues occur, check the specific contract files

4. **Memory issues:**
   - For large datasets, consider processing in batches
   - Monitor system memory during processing

### Debug Mode

For detailed debugging, use:

```bash
python scripts/populate_knowledge_base.py --log-level DEBUG
```

This will show:
- Individual file processing steps
- Document creation details
- Metadata extraction information
- Error stack traces

## Integration Points

The SmartBugs integration connects with:

1. **RAG Pipeline** (`src/rag/rag_pipeline.py`):
   - `_load_smartbugs_documents()` method
   - Vector store population
   - Similarity search for relevant vulnerabilities

2. **Configuration** (`src/utils/config.py`):
   - `KNOWLEDGE_BASE_PATH` setting
   - `CHUNK_SIZE` and `CHUNK_OVERLAP` for document processing

3. **Vector Store** (ChromaDB):
   - Document embedding and storage
   - Metadata-based filtering
   - Similarity search capabilities

## Extending the System

To extend the SmartBugs integration:

1. **Add new vulnerability categories:**
   - Update document creation logic
   - Enhance metadata extraction
   - Add category-specific processing

2. **Improve document structure:**
   - Modify `create_vulnerability_document()` method
   - Add more detailed code analysis
   - Include additional context information

3. **Add external datasets:**
   - Create new processor classes
   - Follow similar document structure
   - Integrate with existing pipeline

This system provides a robust foundation for incorporating real-world vulnerability data into your smart contract security analysis pipeline.