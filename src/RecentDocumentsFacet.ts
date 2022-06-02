import { Component, DynamicFacetHeader, IComponentBindings, ComponentOptions, IQueryResult, LocalStorageUtils, $$, Dom, Utils, IChangeAnalyticsCustomDataEventArgs, analyticsActionCauseList, IDynamicFacet, IDynamicFacetOptions } from 'coveo-search-ui';
import { lazyComponent } from '@coveops/turbo-core';

export interface IRecentDocumentsFacetOptions {
    results: IQueryResult[];
    numberOfValues: number;
    recentResultTemplate?: Coveo.Template;
    title?: string;
    noResultMessage?: string;
    enableCollapse?: boolean;
    collapsedByDefault?: boolean;
}

@lazyComponent
export class RecentDocumentsFacet extends Component {
    static ID = 'RecentDocumentsFacet';
    static options: IRecentDocumentsFacetOptions = {
        numberOfValues: ComponentOptions.buildNumberOption({ min: 0, defaultValue: 8 }),
        results: <any>ComponentOptions.buildJsonOption({ defaultValue: [] }),
        title: ComponentOptions.buildLocalizedStringOption({ defaultValue: Coveo.l('RecentDocumentsFacet_title') }),
        noResultMessage: ComponentOptions.buildLocalizedStringOption({ defaultValue: Coveo.l('RecentDocumentsFacet_NoResultsMessage') }),
        enableCollapse: ComponentOptions.buildBooleanOption({ defaultValue: true }),
        collapsedByDefault: ComponentOptions.buildBooleanOption({ defaultValue: false, depend: 'enableCollapse' }),
        recentResultTemplate: ComponentOptions.buildTemplateOption({
            defaultFunction: (e) => Coveo.HtmlTemplate.fromString(RecentDocumentsFacet.defaultRecentResultsTemplate, {}),
            selectorAttr: 'data-template-selector',
            idAttr: 'data-template-id'
        })
    };

    static actionCauseList = [
        analyticsActionCauseList.documentOpen.name,
        analyticsActionCauseList.documentQuickview.name
    ]

    static defaultRecentResultsTemplate = `<div class="CoveoResultLink"></div>`;

    public recentResults: IQueryResult[];
    private analyticsElement: HTMLElement;
    private recentResultsContainer: HTMLElement;
    private recentResultsLocalStorage: LocalStorageUtils<IQueryResult[]>;

    public isCollapsed: boolean;

    constructor(public element: HTMLElement, public options: IRecentDocumentsFacetOptions, public bindings: IComponentBindings) {
        super(element, RecentDocumentsFacet.ID, bindings);
        this.options = ComponentOptions.initComponentOptions(element, RecentDocumentsFacet, options);

        this.analyticsElement = $$(this.root).find(`.${Component.computeCssClassNameForType('Analytics')}`);
        if (!this.analyticsElement) {
            this.logger.warn(`Cannot instantiate RecentDocumentsFacet, as there is no "CoveoAnalytics" in your page !`);
            return;
        }

        this.isCollapsed = this.options.enableCollapse && this.options.collapsedByDefault;

        this.recentResultsLocalStorage = new LocalStorageUtils<IQueryResult[]>(RecentDocumentsFacet.ID);
        this.mergeLocalResultsWithStaticResults();

        this.bindAnalyticsEvent();
        this.createDom();

    }

    private bindAnalyticsEvent() {
        this.bind.onRootElement(Coveo.AnalyticsEvents.changeAnalyticsCustomData, (args: IChangeAnalyticsCustomDataEventArgs) => this.handleChangeAnalyticsCustomData(args));
    }

    public createDom() {
        this.createAndAppendHeader();

        if (this.options.enableCollapse){
            this.isCollapsed = !this.isCollapsed;
            this.toggleCollapse();
        }

        this.recentResultsContainer = $$('div', { class: 'coveo-recent-results-list-container' }).el;
        const body = $$('ul', { class: 'coveo-dynamic-facet-values' });
        body.append(this.recentResultsContainer);
        this.element.appendChild(body.el);

        this.updateRecentResults(this.recentResults);
    }

    private createAndAppendHeader() {
        var header = $$('div', { className: 'coveo-dynamic-facet-header' });

        $$(header).append(this.createTitle().el);
        if (this.options.enableCollapse)
            $$(header).append(this.createCollapseToggle().el);

        this.element.appendChild(header.el);

    }

    private createTitle() {
        return $$(
            'h2',
            {
                className: 'coveo-dynamic-facet-header-title',
                ariaLabel: `${Coveo.l(this.options.title)}`,
            },
            $$('span', { ariaHidden: true, title: Coveo.l(this.options.title) }, Coveo.l(this.options.title))
        );
    }

    private createCollapseToggle() {
        var collapseToggle = $$('div', {});

        var Collapse = $$(
            'button',
            {
                className: `coveo-dynamic-facet-header-btn coveo-dynamic-facet-header-collapse`.trim(),
                type: 'button',
                title: 'Collapse Type facet'
            },
            '<svg focusable="false" enable-background="new 0 0 10 6" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Arrow Up" class="coveo-dynamic-facet-collapse-toggle-svg"><title>Arrow Up</title><g fill="currentColor"><path d="m5 .068c.222 0 .443.084.612.253l4.134 4.134c.338.338.338.886 0 1.224s-.886.338-1.224 0l-3.522-3.521-3.523 3.521c-.336.338-.886.338-1.224 0s-.337-.886.001-1.224l4.134-4.134c.168-.169.39-.253.612-.253z"></path></g></svg>'
        );
        var Expand = $$(
            'button',
            {
                className: `coveo-dynamic-facet-header-btn coveo-dynamic-facet-header-expand`.trim(),
                type: 'button',
                title: 'Expand Type facet'
            },
            '<svg focusable="false" enable-background="new 0 0 10 6" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Arrow Down" class="coveo-dynamic-facet-collapse-toggle-svg"><title>Arrow Down</title><g fill="currentColor"><path d="m5 5.932c-.222 0-.443-.084-.612-.253l-4.134-4.134c-.338-.338-.338-.886 0-1.224s.886-.338 1.224 0l3.522 3.521 3.523-3.521c.336-.338.886-.338 1.224 0s .337.886-.001 1.224l-4.135 4.134c-.168.169-.39.253-.611.253z"></path></g></svg>'
        );
        Collapse.on('click', () =>{
            this.toggleCollapse();
        });
        Expand.on('click', () =>{
            this.toggleCollapse();
        });

        $$(collapseToggle).append(Collapse.el);
        $$(collapseToggle).append(Expand.el);
        
        return collapseToggle;

    }


    public toggleCollapse() {
        this.isCollapsed ? this.expand() : this.collapse();
    }

    public expand() {
        this.isCollapsed = false;
        $$(this.element).find('.coveo-dynamic-facet-header-collapse').style.display = 'none';
        $$(this.element).find('.coveo-dynamic-facet-header-expand').style.display = 'inline-block';
        $$(this.element).toggleClass('coveo-dynamic-facet-collapsed', this.isCollapsed);
    }

    public collapse() {
        this.isCollapsed = true;
        $$(this.element).find('.coveo-dynamic-facet-header-expand').style.display = 'none';
        $$(this.element).find('.coveo-dynamic-facet-header-collapse').style.display = 'inline-block';
        $$(this.element).toggleClass('coveo-dynamic-facet-collapsed', this.isCollapsed);
    }



    private handleChangeAnalyticsCustomData(args: IChangeAnalyticsCustomDataEventArgs) {
        if (args.type == 'ClickEvent' && RecentDocumentsFacet.actionCauseList.includes(args.actionCause) && args['resultData']) {
            const { searchInterface, ...result } = args['resultData'];
            this.addToRecentResults(this.resetHightlights(result));
            this.save();
        }
    }

    private resetHightlights(result) {
        return {
            ...result,
            excerptHighlights: [],
            firstSentencesHighlights: [],
            phrasesToHighlights: [],
            printableUriHighlights: [],
            summaryHighlights: [],
            titleHighlights: []
        }
    }

    private mergeLocalResultsWithStaticResults() {
        const staticResults = this.options.results;
        const localResults = this.recentResultsLocalStorage.load() || [];

        if (staticResults.length) {
            const localResultsWithoutRemoved = _.filter(localResults, localResult => {
                const existsInStatic = _.find(staticResults, staticResult => {
                    return staticResult.uniqueId == localResult.uniqueId;
                });
                return existsInStatic != undefined;
            });

            this.recentResults = <IQueryResult[]>Utils.extendDeep(staticResults, localResultsWithoutRemoved);
        } else {
            this.recentResults = localResults;
        }
    }

    private save() {
        this.logger.info('Saving recent result', this.recentResults);
        this.recentResultsLocalStorage.save(this.recentResults);
        this.updateRecentResults(this.recentResults);
    }

    private addToRecentResults(result: IQueryResult) {

        if (this.recentResults.length) {
            this.recentResults.unshift(result);
        } else {
            this.recentResults.push(result);
        }

        if (this.recentResults.length > this.options.numberOfValues) {
            this.recentResults.pop();
        }
    }

    public async updateRecentResults(results: IQueryResult[]) {
        if (this.recentResultsContainer) {
            this.recentResultsContainer.innerHTML = '';

            if (results.length) {

                for (const r of results) {
                    const domRecentResult = await this.prepareRecentResult(r);
                    const coveoResult = $$('div', { class: 'CoveoResult coveo-dynamic-facet-value' }, domRecentResult);
                    this.recentResultsContainer.appendChild(coveoResult.el);
                }

            } else {
                const noRecentResult = $$('div', { class: 'coveo-recent-results-list-no-result' }, Coveo.l(this.options.noResultMessage));
                this.recentResultsContainer.appendChild(noRecentResult.el);
            }

        } else {
            this.logger.error('recentResultsContainer is null');
        }
    }

    private async prepareRecentResult(result: IQueryResult): Promise<Dom> {
        const domContent = await this.instantiateTemplateToDom(result);

        const initOptions = this.searchInterface.options;
        const initParameters: Coveo.IInitializationParameters = {
            options: initOptions,
            bindings: this.getBindings(),
            result: result
        };

        await Coveo.Initialization.automaticallyCreateComponentsInside(domContent.el, initParameters).initResult;
        return domContent;
    }

    private async instantiateTemplateToDom(result: IQueryResult): Promise<Dom> {
        let templateInstantiated: HTMLElement;
        templateInstantiated = await this.options.recentResultTemplate.instantiateToElement(result) as HTMLElement;
        return $$(templateInstantiated);
    }

}