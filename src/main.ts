import { Plugin } from 'obsidian';
import { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';
import { around } from "monkey-around";

import { LivePreviewOptions, DEFAULT_SETTINGS, LivePreviewOptionsSettingTab } from 'settings';


export default class LivePreviewOptionsPlugin extends Plugin {
	settings: LivePreviewOptions;

	async onload() {
		await this.loadSettings();
		await this.saveSettings();
		this.addSettingTab(new LivePreviewOptionsSettingTab(this));

		patchDecoration(this);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


const patchDecoration = (plugin: LivePreviewOptionsPlugin) => {
	const uninstaller = around(Decoration, {
		set(old) {
			return function (of: Range<Decoration> | readonly Range<Decoration>[], sort?: boolean) {
				if (Array.isArray(of)) {
					const ranges: Range<Decoration>[] = [];
					for (const range of of) {
						if (!(range.value.widget && shouldBeIgnored(plugin, range.value.widget))) {
							ranges.push(range);
						}
					}
					return old.call(this, ranges, sort);
				} else {
					const range: any = of;
					if (range.value.widget && shouldBeIgnored(plugin, range.value.widget)) {
						return Decoration.none;
					}
					return old.call(this, of, sort);
				}
			}
		},
	});

	plugin.register(uninstaller);
}


interface MathWidget extends WidgetType {
	math: string;
	block: boolean;
}

const isMathWidget = (widget: WidgetType): widget is MathWidget => {
	const proto = widget.constructor.prototype;
	const superProto = Object.getPrototypeOf(proto);
	const superSuperProto = Object.getPrototypeOf(superProto);
	return Object.hasOwn(widget, 'math')
		&& Object.hasOwn(widget, 'block')
		&& Object.hasOwn(proto, 'eq')
		&& Object.hasOwn(proto, 'initDOM')
		&& Object.hasOwn(proto, 'patchDOM')
		&& Object.hasOwn(proto, 'render')
		&& !Object.hasOwn(proto, 'toDOM')
		&& !Object.hasOwn(proto, 'updateDOM')
		&& Object.hasOwn(superProto, 'become')
		&& Object.hasOwn(superProto, 'updateDOM')
		&& Object.hasOwn(superSuperProto, 'addEditButton')
		&& Object.hasOwn(superSuperProto, 'hookClickHandler')
		&& Object.hasOwn(superSuperProto, 'resizeWidget')
		&& Object.hasOwn(superSuperProto, 'setOwner')
		&& Object.hasOwn(superSuperProto, 'setPos')
		&& Object.hasOwn(superSuperProto, 'toDOM')
		&& Object.getPrototypeOf(superSuperProto) === WidgetType.prototype;
}

const shouldBeIgnored = (plugin: LivePreviewOptionsPlugin, widget: WidgetType) => {
	if (isMathWidget(widget)) {
		if (!plugin.settings.inlineMath && !widget.block) {
			return true;
		}
		if (!plugin.settings.displayMath && widget.block) {
			return true;
		}
	}
	return false;
}