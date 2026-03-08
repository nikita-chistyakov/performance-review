# Performance Review Form

A modern, AI-powered performance review form designed specifically for CTOs to evaluate ML Engineer Interns (or any engineering role). This tool streamlines the review process by allowing managers to input raw, honest notes and automatically polishing them into a professional, structured evaluation ready for printing.

**[🚀 View Live Preview](https://ais-pre-skcdx5nzlrhvghtupofaew-276322185514.europe-west2.run.app)**

## Features

- **Structured Competency Ratings**: Evaluate interns across 5 key engineering competencies (Understanding Code, Observability, Presentation, Feature Development, Initiative & Learning).
- **Customizable Categories**: Easily edit category names and descriptions to fit specific roles or expectations.
- **Raw Feedback to Polished Review**: Write raw "Keep Doing", "Stop Doing", and "Start Doing" notes. The built-in AI automatically restructures and polishes them into a professional tone.
- **Skill Radar Visualization**: Automatically generates a radar chart and rating breakdown based on your scores.
- **Print-Ready Output**: Generates a clean, professional HTML document ready to be printed or saved as a PDF.
- **Auto-Save**: All progress is automatically saved to your browser's local storage so you never lose your work.
- **Self-Contained AI**: Uses the Gemini API to handle all feedback polishing behind the scenes—no manual API key configuration required by the user.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS (inline styles for print compatibility)
- **Charts**: Recharts (Radar Chart)
- **AI Integration**: `@google/genai` (Gemini 3.1 Pro)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/performance-review-form.git
   cd performance-review-form
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000` (or the port specified by Vite).

## Usage

1. **Welcome Tab**: Enter your name (CTO) and the Intern's name.
2. **Ratings Tab**: Rate the intern from 1 to 5 across the predefined competencies. Click on any competency title or description to customize it.
3. **Feedback Tab**: Write raw, bullet-point notes on what the intern should Keep, Stop, and Start doing. Add an optional overall note for context.
4. **Preview & Print Tab**: Review the generated radar chart and rating breakdown. Click "Generate AI Evaluation" to have Gemini polish your raw notes. Once satisfied, click "Print Full Evaluation" to generate a print-ready document.

## License

This project is licensed under the Apache 2.0 License.
