# Athena Express Backend

Welcome to the Athena Express Backend repository. This project is an API designed to support the Athena Chrome Extension, providing advanced content parsing and analysis capabilities.

## Overview

The Athena Express Backend is built using Express.js and serves as a powerful tool for processing and analyzing website content. It leverages Large Language Models (LLMs) to intelligently parse and extract meaningful information from web pages.

## Features

- **Content Cleaning**: The API takes in raw website content and cleans it up for further processing.
- **Intelligent Parsing**: Utilizes LLMs to smartly parse content, identifying key elements such as journalists and publications.
- **Database Integration**: Extracted information about journalists and publications is stored in a database for future reference.
- **Summary Generation**: Generates concise summaries of articles, providing quick insights into the content.
- **Bias Analysis**: Analyzes and highlights potential biases in the article, as well as those associated with the journalists and publications.

## Getting Started

To get started with the Athena Express Backend, follow these steps:

1. **Clone the Repository**:

   ```bash
   git clone <repository-url>
   ```

2. **Install Dependencies**:
   Navigate to the project directory and install the necessary dependencies:

   ```bash
   cd athena-express-backend
   npm install
   ```

3. **Run the Server**:
   Start the Express server:
   ```bash
   npm start
   ```

## Usage

The API provides endpoints for submitting website content and retrieving parsed information. Detailed API documentation can be found in the `docs` directory.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.

---

This README provides a comprehensive overview of the Athena Express Backend, highlighting its capabilities and guiding users on how to get started. Feel free to customize it further to suit your project's needs.
