import { bold, whiteBright, greenBright } from "colorette";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import inquirer from "inquirer";
import { join } from "path";
import Yargs from "yargs";
import Logger from "../../utils/Logger";
const { prompt } = inquirer;

const GITHUB_REGEXP =
    /^(?:(?:https:\/\/github.com\/([a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}\/[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38})(?:\.git)?)|([a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}\/[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}))$/i;

const TEMPLATES = readdirSync(join(__dirname, "../../../templates")).map((e) => {
    const templatePath = join(__dirname, "../../../templates", e);
    if (existsSync(join(templatePath, "wsce.properties.json")))
        return {
            name: JSON.parse(readFileSync(join(templatePath, "wsce.properties.json"), "utf8"))
                ?.name,
            path: e,
        };
    else
        return {
            path: e,
            name: e
                .split(" ")
                .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
                .join(" "),
        };
});

export const command = "init [name]";

export const describe = "Init a new wsce project";

export const builder = (yargs: typeof Yargs) =>
    yargs
        .positional("name", { describe: "Name for your project", type: "string" })
        .option("template", { describe: "The template to use for this project", type: "string" })
        .option("verbose", {
            alias: "v",
            type: "boolean",
            count: true,
        });

export const handler = async (args: any) => {
    const logger = new Logger(false, args.v);
    if (args.name && !/^([A-Za-z\-\_\d])+$/.test(args.name))
        return logger.error(
            "Project name may only include letters, numbers, underscores and hashes."
        );
    if (args.template && !existsSync(join(__dirname, "../../../templates", args.template)))
        return logger.error(`The "${args.template}" does not exist !`);
    const QUESTIONS = [
        {
            name: "template",
            type: "list",
            choices: TEMPLATES,
            message: "What project template would you like to generate?",
            when: !Boolean(args.template),
            // validate: async (input: string) => {
            //     input = input || "";
            //     if (TEMPLATES.some((e) => e.name.toLowerCase() === input.toLowerCase()))
            //         return true;
            //     const githubUrl = getGithubURL(input);
            //     if (githubUrl) {
            //         try {
            //             const { data: commits } = await axios.get(
            //                 `https://api.github.com/repos/${githubUrl.parsed}/commits`
            //             );
            //             const sha = commits[0].commit.tree.sha;
            //             const {
            //                 data: { tree },
            //             } = await axios.get(
            //                 `https://api.github.com/repos/${githubUrl.parsed}/git/trees/${sha}`
            //             );
            //             return (
            //                 ["wsce.config.js", "wsce.properties.json"].every((e) =>
            //                     tree.some((f: any) => f.path === e)
            //                 ) || "The repo isn't a template"
            //             );
            //         } catch (e) {
            //             logger.debug(`\nCouldn't GET the repo URL: ${e}`);
            //             return "No Github / Template found for this";
            //         }
            //     } else return false;
            // },
        },
        {
            name: "name",
            type: "input",
            message: "Project name:",
            validate: (input: string) =>
                /^([A-Za-z\-\_\d])+$/.test(input)
                    ? true
                    : "Project name may only include letters, numbers, underscores and hashes.",
            when: !Boolean(args.name),
        },
    ];
    const answers = await prompt<any>(QUESTIONS);
    const template = answers.template || args.template;
    let templatePath = join(
        __dirname,
        "../../../templates",
        template /** .replace(/http(s?):\/\/github.com\//, "").replace("/", "-") */
    );
    // if (!existsSync(templatePath))
    //     templatePath = join(
    //         __dirname,
    //         "../../../templates",
    //         TEMPLATES.find((e) => e.name.toLowerCase() === template.toLowerCase())?.path as string
    //     );
    if (!existsSync(templatePath))
        return logger.error(
            "Couldn't find this template, make sure it is correctly installed: ",
            templatePath
        );
    const name = answers.name || args.name;

    const projectPath = join(process.cwd(), name);
    // const githubURL = getGithubURL(template);
    // if (githubURL && !existsSync(templatePath)) {
    //     spinner.text = "Cloning the repository...";
    //     try {
    //         await git.clone(githubURL.url, templatePath);
    //     } catch (e) {
    //         spinner.stop();
    //         return logger.error("Couldn't clone the repository: " + e);
    //     }
    // }
    if (existsSync(projectPath)) {
        return logger.error(
            `A folder named "${name}" already exists, please remove it before creating a new project`
        );
    }

    mkdirSync(projectPath);
    createDirectoryContents(templatePath, name, ["wsce.properties.json"]);
    logger.log(
        "success",
        greenBright,
        `Finished creating your project !
    - Use ${whiteBright(bold(`cd ${name}`))} to start hacking !
    - Edit ${whiteBright(bold(`wsce.config.js`))} to edit the configuration.`
    );
};

const createDirectoryContents = (
    templatePath: string,
    newProjectPath: string,
    ignore?: string[]
) => {
    const filesToCreate = readdirSync(templatePath).filter((e) => !ignore?.includes(e));
    filesToCreate.forEach((file) => {
        const origFilePath = join(templatePath, file);
        const stats = statSync(origFilePath);
        if (stats.isFile()) {
            writeFileSync(
                join(process.cwd(), newProjectPath, file),
                readFileSync(origFilePath, "utf8"),
                "utf8"
            );
        } else if (stats.isDirectory()) {
            mkdirSync(join(process.cwd(), newProjectPath, file));
            createDirectoryContents(origFilePath, join(newProjectPath, file));
        }
    });
};

const getGithubURL = (input: string) => {
    const matches = input.match(GITHUB_REGEXP);
    if (matches) return { url: `https://github.com/${matches[1]}.git`, parsed: matches[1] };
    return null;
};
