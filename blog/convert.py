import os
import markdown
import yaml
from jinja2 import Template

def read_markdown_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split the content into frontmatter and markdown
    _, frontmatter, markdown_content = content.split('---', 2)
    
    # Parse the frontmatter
    metadata = yaml.safe_load(frontmatter)
    
    return metadata, markdown_content

def convert_markdown_to_html():
    # Read the template
    with open('template.html', 'r', encoding='utf-8') as f:
        template_content = f.read()
    
    template = Template(template_content)
    md = markdown.Markdown()
    
    # Get all markdown files in the current directory
    for filename in os.listdir('.'):
        if filename.endswith('.md'):
            # Read and parse the markdown file
            metadata, markdown_content = read_markdown_file(filename)
            
            # Convert markdown to HTML
            html_content = md.convert(markdown_content)
            
            # Render the template
            output = template.render(
                title=metadata['title'],
                date=metadata['date'],
                category=metadata['category'],
                image=metadata['image'],
                content=html_content
            )
            
            # Write the output HTML file
            output_filename = filename.replace('.md', '.html')
            with open(output_filename, 'w', encoding='utf-8') as f:
                f.write(output)
            
            print(f'Converted {filename} to {output_filename}')

if __name__ == '__main__':
    convert_markdown_to_html()
