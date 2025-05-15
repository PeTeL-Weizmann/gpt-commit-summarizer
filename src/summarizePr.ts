import {
  MAX_OPEN_AI_QUERY_LENGTH,
  MAX_TOKENS,
  MODEL_NAME,
  openai,
  TEMPERATURE,
} from "./openAi";

// const OPEN_AI_PROMPT = `You are a Moodle expert programmer, and you are trying to summarize a pull request.
// You went over every commit that is part of the pull request and over every file that was changed in it.
// For some of these, there was an error in the commit summary, or in the files diff summary.
// Please summarize the pull request. Write your response in bullet points, starting each bullet point with a \`*\`.
// Write a high level description. Do not repeat the commit summaries or the file summaries.
// Write the most important bullet points. The list should not be more than a few bullet points.
// `;

const OPEN_AI_PROMPT = `
You are a senior Moodle developer reviewing a set of code changes in a Moodle 4.x codebase.
For each file that was changed, provide a structured code review according to Moodle standards.
Focus your review on these areas:
1. **Coding Style** – PSR-12 and Moodle frankenstyle: indentation, spacing, naming conventions, consistent brace placement.
2. **Security** – Ensure use of require_login(), require_sesskey() where applicable, secure SQL (with placeholders), escaping output with s(), format_text(), or clean_text().
3. **API Usage** – Proper use of Moodle’s core APIs: DB, Access, Output, Form, File, etc.
4. **Internationalization (i18n)** – All user-facing text should use get_string(); no hardcoded strings.
5. **Accessibility** – Semantic HTML elements, ARIA roles, form labeling, and full keyboard accessibility.
6. **Documentation** – PHPDoc for public classes/functions, inline comments for non-obvious logic.
7. **Testing** – Presence of PHPUnit or manual testing coverage where relevant.
8. **Performance** – No DB calls in loops, efficient data access, use of caching (MUC) and batch operations.
9. **Code Organization** – Follow Moodle's folder structure and best practices: templates for HTML, renderers for output logic, classes/ for backend logic.
Output your review in bullet points grouped by category. Reference filenames and lines where applicable. Avoid summarizing commit messages — focus on reviewing the actual code content.
`;


const linkRegex = /\[.*?\]\(https:\/\/github\.com\/.*?[a-zA-Z0-f]{40}\/(.*?)\)/;

function preprocessCommitMessage(commitMessage: string): string {
  let match = commitMessage.match(linkRegex);
  while (match !== null) {
    commitMessage = commitMessage.split(match[0]).join(`[${match[1]}]`);
    match = commitMessage.match(linkRegex);
  }
  return commitMessage;
}

export async function summarizePr(
  fileSummaries: Record<string, string>,
  commitSummaries: Array<[string, string]>
): Promise<string> {
  const commitsString = Array.from(commitSummaries.entries())
    .map(
      ([idx, [, summary]]) =>
        `Commit #${idx + 1}:\n${preprocessCommitMessage(summary)}`
    )
    .join("\n");
  const filesString = Object.entries(fileSummaries)
    .map(([filename, summary]) => `File ${filename}:\n${summary}`)
    .join("\n");
  const openAIPrompt = `${OPEN_AI_PROMPT}\n\nTHE COMMIT SUMMARIES:\n\`\`\`\n${commitsString}\n\`\`\`\n\nTHE FILE SUMMARIES:\n\`\`\`\n${filesString}\n\`\`\`\n\n
  Reminder - write only the most important points. No more than a few bullet points.
  THE PULL REQUEST SUMMARY:\n`;
  console.log(`OpenAI for PR summary prompt:\n${openAIPrompt}`);

  if (openAIPrompt.length > MAX_OPEN_AI_QUERY_LENGTH) {
    return "Error: couldn't generate summary. PR too big";
  }

  try {
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: `${openAIPrompt}` }],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });
    return (
      response.choices[0].message?.content ?? "Error: couldn't generate summary"
    );
  } catch (error) {
    console.error(error);
    return "Error: couldn't generate summary";
  }
}
