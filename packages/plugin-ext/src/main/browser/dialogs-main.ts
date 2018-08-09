/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { interfaces } from 'inversify';
import { RPCProtocol } from '../../api/rpc-protocol';
import { OpenDialogOptionsMain, DialogsMain } from '../../api/plugin-api';
import URI from '@theia/core/lib/common/uri';
import { DirNode, FileDialogProps, FileDialogFactory } from '@theia/filesystem/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileSystem } from '@theia/filesystem/lib/common';
import { LabelProvider } from '@theia/core/lib/browser';
import { UriSelection } from '@theia/core/lib/common/selection';

export class DialogsMainImpl implements DialogsMain {

    private workspaceService: WorkspaceService;
    private fileSystem: FileSystem;
    private labelProvider: LabelProvider;
    private fileDialogFactory: FileDialogFactory;

    // private activeElement: HTMLElement | undefined;

    constructor(rpc: RPCProtocol, container: interfaces.Container) {
        this.workspaceService = container.get(WorkspaceService);
        this.fileSystem = container.get(FileSystem);
        this.labelProvider = container.get(LabelProvider);
        this.fileDialogFactory = container.get(FileDialogFactory);
    }

    // private cleanUp() {
    //     if (this.activeElement) {
    //         this.activeElement.focus();
    //     }
    //     this.activeElement = undefined;
    // }

    async $showOpenDialog(options: OpenDialogOptionsMain): Promise<string[] | undefined> {
        let rootStat;

        // Try to use preconfigured default URI as root
        if (options.defaultUri) {
            rootStat = await this.fileSystem.getFileStat(options.defaultUri);
        }

        // Try to use workspace service root if there is no preconfigured URI
        if (!rootStat) {
            rootStat = (await this.workspaceService.roots)[0];
        }

        // Try to use current user home if root folder is still not taken
        if (!rootStat) {
            rootStat = await this.fileSystem.getCurrentUserHome();
        }

        // Fail of root not fount
        if (!rootStat) {
            throw new Error('Unable to find the rootStat');
        }

        // Take the info for root node
        const rootUri = new URI(rootStat.uri);
        const name = this.labelProvider.getName(rootUri);
        const icon = await this.labelProvider.getIcon(rootUri);
        const rootNode = DirNode.createRoot(rootStat, name, icon);

        try {
            // Determine proper title for the dialog
            const canSelectFiles = typeof options.canSelectFiles === 'boolean' ? options.canSelectFiles : true;
            const canSelectFolders = typeof options.canSelectFolders === 'boolean' ? options.canSelectFolders : true;

            let title;
            if (canSelectFiles && canSelectFolders) {
                title = 'Open';
            } else {
                if (canSelectFiles) {
                    title = 'Open File';
                } else {
                    title = 'Open Folder';
                }

                if (options.canSelectMany) {
                    title += '(s)';
                }
            }

            // Create dialog props
            const dialogProps = {
                title: title,
                openLabel: options.openLabel,
                canSelectFiles: options.canSelectFiles,
                canSelectFolders: options.canSelectFolders,
                canSelectMany: options.canSelectMany,
                filters: options.filters
            } as FileDialogProps;

            // Open the dialog
            const dialog = this.fileDialogFactory(dialogProps);
            dialog.model.navigateTo(rootNode);
            const result = await dialog.open();

            // Return the result
            return UriSelection.getUris(result).map(uri => uri.path.toString());
        } catch (error) {
            console.log(error);
        }

        return undefined;
    }

}
