import { DEFAULT_CALLEE_NAMES, DEFAULT_CLASS_NAMES } from "eptm:utils:config.js";
import {
  findStartPosition,
  getCallExpressionLiterals,
  getClassAttributeLiterals,
  getClassAttributes
} from "eptm:utils:jsx.js";
import { splitClasses } from "eptm:utils:utils.js";

import type { Rule } from "eslint";
import type { Node } from "estree";
import type { JSXOpeningElement } from "estree-jsx";
import type { Meta } from "src/types/ast.js";
import type { ESLintRule } from "src/types/rule.js";

import type { StringLiteral, TemplateLiteralString } from "eptm:utils:jsx.js";


export type Options = [
  {
    callees?: string[];
    classAttributes?: string[];
    classesPerLine?: number;
    group?: "emptyLine" | "never" | "newLine";
    indent?: number | "tab";
    printWidth?: number;
    trim?: boolean;
  }
];

export const tailwindMultiline: ESLintRule<Options> = {
  name: "multiline" as const,
  rule: {
    create(ctx) {

      const { callees, classesPerLine, indent, printWidth } = getOptions(ctx);

      const splitLines = (ctx: Rule.RuleContext, literal: StringLiteral | TemplateLiteralString, startPosition: number): Lines => {

        const classChunks = splitClasses(literal.content);
        const groupedClasses = groupClasses(ctx, classChunks);

        const lines = new Lines(ctx, startPosition);

        if(literal.openingQuote){
          lines.line.addMeta({ openingQuote: "`" });
        }

        if(literal.type === "TemplateElement" && literal.closingBraces){
          lines.line.addMeta({ closingBraces: literal.closingBraces });
        }

        if(groupedClasses){
          for(const group of groupedClasses.groups){

            lines.addLine();

            if(group.classCount === 0){
              continue;
            }

            lines.line.indent();

            for(const className of group.classes){

              const simulatedLine = lines.line
                .clone()
                .addClass(className)
                .toString();

              if(simulatedLine.length > printWidth || lines.line.classCount >= classesPerLine){
                lines.addLine();
                lines.line.indent();
              }

              lines.line.addClass(className);

            }
          }
        }

        if(literal.type === "TemplateElement" && literal.openingBraces){
          lines.addLine();
          lines.line.indent();
          lines.line.addMeta({ openingBraces: literal.openingBraces });
        }

        if(literal.closingQuote){
          lines.addLine();
          lines.line.indent(startPosition - getIndentation(ctx, indent));
          lines.line.addMeta({ closingQuote: "`" });
        }

        return lines;

      };


      return {

        CallExpression(node) {

          const { callee } = node;

          if(callee.type !== "Identifier"){ return; }
          if(!callees.includes(callee.name)){ return; }

          const literals = getCallExpressionLiterals(ctx, node.arguments);

          for(const literal of literals){
            if(literal === undefined){ continue; }

            const startPosition = findStartPosition(ctx, literal) + getIndentation(ctx, indent);
            const lines = splitLines(ctx, literal, startPosition);

            if(lines.length === 3 && (
              literal.type === "TemplateElement" && !literal.openingBraces && !literal.closingBraces ||
              literal.type === "Literal"
            )){
              continue;
            }

            const fixedClasses = lines.toString();

            if(literal.type === "Literal"){

              ctx.report({
                data: {
                  rawLiteral: literal.raw
                },
                fix(fixer) {
                  return fixer.replaceText(literal, `\`${fixedClasses}\``);
                },
                message: "Invalid literal string: {{ rawLiteral }}.",
                node
              });
            }

            if(literal.raw === fixedClasses){
              return;
            }

            ctx.report({
              data: {
                notReadable: literal.content
              },
              fix(fixer) {
                return fixer.replaceText(literal, fixedClasses);
              },
              message: "Invalid line wrapping: {{ notReadable }}.",
              node
            });

          }

        },

        JSXOpeningElement(node: Node) {

          const jsxNode = node as JSXOpeningElement;

          const attributes = getClassAttributes(ctx, jsxNode);

          for(const attribute of attributes){

            const attributeValue = attribute.value;
            const attributeName = attribute.name.name;

            if(!attributeValue){ continue; }
            if(typeof attributeName !== "string"){ continue; }

            const startPosition = findStartPosition(ctx, attribute) + getIndentation(ctx, indent);
            const literals = getClassAttributeLiterals(ctx, attribute);

            for(const literal of literals){

              if(literal === undefined){ continue; }

              const lines = splitLines(ctx, literal, startPosition);

              if(lines.length === 3 && (
                literal.type === "TemplateElement" && !literal.openingBraces && !literal.closingBraces ||
                literal.type === "Literal"
              )){
                continue;
              }

              const fixedClasses = lines.toString();

              if(attributeValue.type === "Literal"){
                ctx.report({
                  data: {
                    attributeName,
                    rawAttribute: attributeValue.raw ?? ""
                  },
                  fix(fixer) {
                    return fixer.replaceText(attributeValue, `{${fixedClasses}}`);
                  },
                  message: "Invalid jsx attribute quotes: {{ attributeName }}={{ rawAttribute }}.",
                  node
                });
              }

              if(literal.raw === fixedClasses){
                return;
              }

              ctx.report({
                data: {
                  notReadable: literal.content
                },
                fix(fixer) {
                  return fixer.replaceText(literal, fixedClasses);
                },
                message: "Invalid line wrapping: {{ notReadable }}.",
                node
              });

            }

          }

        }

      };
    },
    meta: {
      docs: {
        category: "Stylistic Issues",
        description: "Enforce consistent line wrapping for tailwind classes.",
        recommended: true
      },
      fixable: "code",
      schema: [
        {
          additionalProperties: false,
          properties: {
            callees: {
              default: getOptions().callees,
              description: "List of function names whose arguments should also be considered.",
              items: {
                type: "string"
              },
              type: "array"
            },
            classAttributes: {
              items: {
                default: getOptions().classAttributes,
                description: "The name of the attribute that contains the tailwind classes.",
                type: "string"
              },
              type: "array"
            },
            classesPerLine: {
              default: getOptions().classesPerLine,
              description: "The maximum number of classes per line.",
              type: "integer"
            },
            group: {
              default: getOptions().group,
              description: "The group separator.",
              enum: ["emptyLine", "never", "newLine"],
              type: "string"
            },
            indent: {
              default: getOptions().indent,
              description: "Determines how the code should be indented.",
              oneOf: [
                {
                  enum: ["tab"],
                  type: "string"
                },
                {
                  minimum: 0,
                  type: "integer"
                }
              ],
              type: "integer"

            },
            printWidth: {
              default: getOptions().printWidth,
              description: "The maximum line length. Lines are wrapped appropriately to stay within this limit or within the limit provided by the classesPerLine option."
            }
          },
          type: "object"
        }
      ],
      type: "layout"
    }
  }
};


class Lines {

  private lines: Line[] = [];
  private currentLine: Line | undefined;
  private startPosition = 0;
  private ctx: Rule.RuleContext;

  constructor(ctx: Rule.RuleContext, startPosition: number) {
    this.ctx = ctx;
    this.startPosition = startPosition;

    this.addLine();
  }

  public get line() {
    return this.currentLine!;
  }

  public get length() {
    return this.lines.length;
  }

  public addLine() {
    const line = new Line(this.ctx, this.startPosition);
    this.lines.push(line);
    this.currentLine = line;
    return this;
  }

  public toString() {
    return this.lines.map(
      line => line.toString()
    ).join("\n");
  }

}

class Line {

  private classes: string[] = [];
  private meta: Meta = {};
  private ctx: Rule.RuleContext;
  private startPosition = 0;

  constructor(ctx: Rule.RuleContext, startPosition: number) {
    this.ctx = ctx;
    this.startPosition = startPosition;
  }

  public indent(start: number = this.startPosition) {
    const indent = getOptions(this.ctx).indent;

    if(indent === "tab"){
      this.meta.indentation = "\t".repeat(start);
    } else {
      this.meta.indentation = " ".repeat(start);
    }

    return this;
  }

  public get length() {
    return this.toString().length;
  }

  public get classCount() {
    return this.classes.length;
  }

  public get printWidth() {
    return this.toString().length;
  }

  public addMeta({ closingBraces, closingQuote, openingBraces, openingQuote }: Meta) {
    this.meta = { ...this.meta, closingBraces, closingQuote, openingBraces, openingQuote };
    return this;
  }

  public addClass(className: string) {
    this.classes.push(className);
    return this;
  }

  public clone() {
    const line = new Line(this.ctx, this.startPosition);
    line.classes = [...this.classes];
    line.meta = { ...this.meta };
    return line;
  }

  public toString() {
    return this.join([
      this.meta.indentation,
      this.meta.openingQuote,
      this.join([
        this.meta.closingBraces,
        ...this.classes,
        this.meta.openingBraces
      ]),
      this.meta.closingQuote
    ], "");
  }

  private join(content: (string | undefined)[], separator: string = " ") {
    return content
      .filter(content => content !== undefined)
      .join(separator);
  }
}

function groupClasses(ctx: Rule.RuleContext, classes: string[]) {

  if(classes.length === 0){
    return;
  }

  const { group } = getOptions(ctx);

  const groups = new Groups();

  for(const className of classes){

    const isFirstClass = classes.indexOf(className) === 0;
    const isFirstGroup = groups.length === 1;

    const lastGroup = groups.at(-1);
    const lastClass = lastGroup?.at(-1);
    const lastModifier = lastClass?.match(/^.*?:/)?.[0];
    const modifier = className.match(/^.*?:/)?.[0];

    if(lastModifier !== modifier && !(isFirstClass && isFirstGroup)){
      if(group === "emptyLine"){
        groups.addGroup();
        groups.addGroup();
      } else if(group === "newLine"){
        groups.addGroup();
      }
    }

    groups.group.addClass(className);

  }

  return groups;

}

class Groups {

  public readonly groups: Group[] = [];
  private currentGroup: Group | undefined;

  constructor() {
    this.addGroup();
  }

  public get group() {
    return this.currentGroup!;
  }

  public at(index: number) {
    return this.groups.at(index);
  }

  public get length() {
    return this.groups.length;
  }

  public addGroup() {
    const group = new Group();
    this.currentGroup = group;
    this.groups.push(this.currentGroup);
    return this;
  }
}

class Group {

  public readonly classes: string[] = [];

  public get classCount() {
    return this.classes.length;
  }

  public at(index: number) {
    return this.classes.at(index);
  }

  public addClass(className: string) {
    this.classes.push(className);
    return this;
  }
}

function getIndentation(ctx: Rule.RuleContext, indentation: Options[0]["indent"]): number {
  return indentation === "tab" ? 1 : indentation ?? 0;
}

function getOptions(ctx?: Rule.RuleContext) {

  const options: Options[0] = ctx?.options[0] ?? {};

  const printWidth = options.printWidth ?? 80;
  const classesPerLine = options.classesPerLine ?? 100_000;
  const indent = options.indent ?? 4;
  const group = options.group ?? "emptyLine";

  const classAttributes = options.classAttributes ?? DEFAULT_CLASS_NAMES;
  const callees = options.callees ?? DEFAULT_CALLEE_NAMES;

  return {
    callees,
    classAttributes,
    classesPerLine,
    group,
    indent,
    printWidth
  };

}
