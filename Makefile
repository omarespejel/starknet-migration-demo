.PHONY: help context clean

help:
	@echo "Context generation commands:"
	@echo "  make context         - Generate full project context using repomix"
	@echo "                       - Always run this after code changes for auditors"
	@echo ""
	@echo "Cleanup commands:"
	@echo "  make clean           - Remove generated context files"

context:
	@echo "Generating full project context..."
	@DATE=$$(date '+%Y-%m-%d_%H-%M-%S_%Z'); \
	OUTPUT_FILE="context-full-$${DATE}.xml"; \
	cp repomix.config.json repomix.config.json.bak && \
	jq ".output.filePath = \"$$OUTPUT_FILE\"" repomix.config.json > repomix.config.json.tmp && \
	mv repomix.config.json.tmp repomix.config.json && \
	(repomix --config repomix.config.json || (mv repomix.config.json.bak repomix.config.json && exit 1)) && \
	jq ".output.filePath = \"context-full.xml\"" repomix.config.json > repomix.config.json.tmp && \
	mv repomix.config.json.tmp repomix.config.json && \
	rm -f repomix.config.json.bak && \
	echo "✅ Context written to $$OUTPUT_FILE"

clean:
	@echo "Cleaning generated context files..."
	rm -f context*.xml
	rm -f context-*-*.xml
	rm -f repomix.config.json.bak
	rm -f repomix.config.json.tmp

